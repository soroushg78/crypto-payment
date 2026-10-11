package bscrpc

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"wallet-observer/internal/domain"
	"wallet-observer/pkg/hdwallet"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	DefaultBSCRPC   = "https://bsc-dataseed.binance.org"
	USDTContractBSC = "0x55d398326f99059fF775485246999027B3197955"
	DefaultTreasury = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" // Master Treasury
	BSCChainID      = 56                                          // BNB Smart Chain Mainnet
)

type Client struct {
	rpcURL     string
	httpClient *http.Client
	hdManager  *hdwallet.Manager
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func NewClient(rpcURL string, hdManager *hdwallet.Manager) *Client {
	if rpcURL == "" {
		rpcURL = DefaultBSCRPC
	}
	return &Client{
		rpcURL: rpcURL,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		hdManager: hdManager,
	}
}

// callRPC sends a JSON-RPC request directly to the BSC node
func (c *Client) callRPC(ctx context.Context, method string, params []interface{}) (json.RawMessage, error) {
	reqBody := rpcRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rpc request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.rpcURL, bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("rpc call to %s failed: %w", c.rpcURL, err)
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("failed to decode rpc response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc node error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// GetBNBBalanceWei fetches the raw native BNB balance in Wei as *big.Int
func (c *Client) GetBNBBalanceWei(ctx context.Context, address string) (*big.Int, error) {
	raw, err := c.callRPC(ctx, "eth_getBalance", []interface{}{address, "latest"})
	if err != nil {
		return nil, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return nil, err
	}

	hexClean := strings.TrimPrefix(hexStr, "0x")
	if hexClean == "" || hexClean == "0" {
		return big.NewInt(0), nil
	}

	val, ok := new(big.Int).SetString(hexClean, 16)
	if !ok {
		return nil, fmt.Errorf("failed to parse hex balance: %s", hexStr)
	}
	return val, nil
}

// GetBNBBalance fetches the native BNB balance of an address directly from the node (in BNB units)
func (c *Client) GetBNBBalance(ctx context.Context, address string) (float64, error) {
	val, err := c.GetBNBBalanceWei(ctx, address)
	if err != nil {
		return 0, err
	}
	f := new(big.Float).SetInt(val)
	bnb := new(big.Float).Quo(f, big.NewFloat(1e18))
	res, _ := bnb.Float64()
	return res, nil
}

// GetUSDTBalanceWei fetches the raw BEP-20 USDT token balance in Wei as *big.Int
func (c *Client) GetUSDTBalanceWei(ctx context.Context, address string) (*big.Int, error) {
	cleanAddr := strings.ToLower(strings.TrimPrefix(address, "0x"))
	if len(cleanAddr) != 40 {
		return nil, fmt.Errorf("invalid address length: %s", address)
	}

	callData := "0x70a08231" + fmt.Sprintf("%064s", cleanAddr)
	callObj := map[string]string{
		"to":   USDTContractBSC,
		"data": callData,
	}

	raw, err := c.callRPC(ctx, "eth_call", []interface{}{callObj, "latest"})
	if err != nil {
		return nil, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return nil, err
	}

	hexClean := strings.TrimPrefix(hexStr, "0x")
	if hexClean == "" || hexClean == "0" {
		return big.NewInt(0), nil
	}

	val, ok := new(big.Int).SetString(hexClean, 16)
	if !ok {
		return nil, fmt.Errorf("failed to parse hex token balance: %s", hexStr)
	}
	return val, nil
}

// GetUSDTBalance fetches the BEP-20 USDT token balance of an address via eth_call
func (c *Client) GetUSDTBalance(ctx context.Context, address string) (float64, error) {
	val, err := c.GetUSDTBalanceWei(ctx, address)
	if err != nil {
		return 0, err
	}
	f := new(big.Float).SetInt(val)
	usdt := new(big.Float).Quo(f, big.NewFloat(1e18))
	res, _ := usdt.Float64()
	return res, nil
}

// GetGasPrice returns the current gas price in Gwei
func (c *Client) GetGasPrice(ctx context.Context) (float64, error) {
	raw, err := c.callRPC(ctx, "eth_gasPrice", []interface{}{})
	if err != nil {
		return 3.0, nil
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return 3.0, nil
	}

	val, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return 3.0, nil
	}

	f := new(big.Float).SetInt(val)
	gwei := new(big.Float).Quo(f, big.NewFloat(1e9))
	res, _ := gwei.Float64()
	return res, nil
}

// GetNonce returns the current transaction count for an address
func (c *Client) GetNonce(ctx context.Context, address string) (uint64, error) {
	raw, err := c.callRPC(ctx, "eth_getTransactionCount", []interface{}{address, "pending"})
	if err != nil {
		return 0, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return 0, err
	}

	val, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return 0, nil
	}
	return val.Uint64(), nil
}

// EstimateGas sends an eth_estimateGas JSON-RPC request to the BSC node
func (c *Client) EstimateGas(ctx context.Context, from, to string, data []byte, value *big.Int) (uint64, error) {
	callObj := map[string]interface{}{
		"from": from,
		"to":   to,
	}
	if len(data) > 0 {
		callObj["data"] = "0x" + hex.EncodeToString(data)
	}
	if value != nil && value.Sign() > 0 {
		callObj["value"] = fmt.Sprintf("0x%x", value)
	}

	raw, err := c.callRPC(ctx, "eth_estimateGas", []interface{}{callObj})
	if err != nil {
		return 0, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return 0, err
	}

	val, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return 0, fmt.Errorf("failed to parse hex gas limit: %s", hexStr)
	}
	return val.Uint64(), nil
}

// EstimateSweepGas queries the live node for gasPrice, estimates gasUnits, and calculates exact BNB refuel needs
func (c *Client) EstimateSweepGas(
	ctx context.Context,
	depositAddress string,
	asset string,
	treasuryAddress string,
) (*domain.GasEstimateResult, error) {
	if treasuryAddress == "" {
		treasuryAddress = DefaultTreasury
	}
	asset = strings.ToUpper(strings.TrimSpace(asset))
	if asset != "BNB" {
		asset = "USDT"
	}

	gasPriceGwei, err := c.GetGasPrice(ctx)
	if err != nil {
		gasPriceGwei = 3.0
	}

	bnbBal, _ := c.GetBNBBalance(ctx, depositAddress)
	usdtBal, _ := c.GetUSDTBalance(ctx, depositAddress)

	var gasUnits uint64 = 21000
	if asset == "USDT" {
		toAddr := common.HexToAddress(treasuryAddress)
		var data []byte
		data = append(data, common.Hex2Bytes("a9059cbb")...)
		data = append(data, common.LeftPadBytes(toAddr.Bytes(), 32)...)
		data = append(data, common.LeftPadBytes(big.NewInt(1000000000000000000).Bytes(), 32)...)

		estUnits, estErr := c.EstimateGas(ctx, depositAddress, USDTContractBSC, data, nil)
		if estErr == nil && estUnits > 0 {
			gasUnits = estUnits
		} else {
			// Standard BEP-20 transfer requires 65,000 gas units (safe standard if balance is 0 and simulation reverts)
			gasUnits = 65000
		}
	}

	totalFeeBNB := float64(gasUnits) * gasPriceGwei * 1e-9
	deficitBNB := 0.0
	needsRefuel := false

	if bnbBal < totalFeeBNB {
		deficitBNB = totalFeeBNB - bnbBal
		needsRefuel = true
	}

	return &domain.GasEstimateResult{
		Asset:          asset,
		DepositAddress: depositAddress,
		GasUnits:       gasUnits,
		GasPriceGwei:   gasPriceGwei,
		TotalFeeBNB:    totalFeeBNB,
		CurrentBNB:     bnbBal,
		CurrentUSDT:    usdtBal,
		DeficitBNB:     deficitBNB,
		NeedsRefuel:    needsRefuel,
		EstimatedAt:    time.Now(),
	}, nil
}

// SendRawTransaction broadcasts an already signed raw transaction hex to the BSC node
func (c *Client) SendRawTransaction(ctx context.Context, rawTxHex string) (string, error) {
	if !strings.HasPrefix(rawTxHex, "0x") {
		rawTxHex = "0x" + rawTxHex
	}

	raw, err := c.callRPC(ctx, "eth_sendRawTransaction", []interface{}{rawTxHex})
	if err != nil {
		return "", err
	}

	var txHash string
	if err := json.Unmarshal(raw, &txHash); err != nil {
		return "", err
	}
	return txHash, nil
}

// ExecuteOrSimulateSweep executes REAL on-chain sweeping without any mocks.
// If the balance is 0, it strictly rejects with a clear error.
func (c *Client) ExecuteOrSimulateSweep(
	ctx context.Context,
	derivationIndex int,
	depositAddress string,
	asset string,
	treasuryAddress string,
	realBroadcast bool,
) (*domain.SweepResult, error) {
	if treasuryAddress == "" {
		treasuryAddress = DefaultTreasury
	}

	asset = strings.ToUpper(strings.TrimSpace(asset))
	if asset != "USDT" && asset != "BNB" {
		asset = "USDT"
	}

	var logs []domain.SweepStepLog
	logStep := func(step int, title, desc, status, txHash, details string) {
		logs = append(logs, domain.SweepStepLog{
			Step:        step,
			Title:       title,
			Description: desc,
			Status:      status,
			TxHash:      txHash,
			Details:     details,
		})
	}

	// 1. Step 1: Query live on-chain balances and estimate gas dynamically from the real BSC node
	gasEstimate, err := c.EstimateSweepGas(ctx, depositAddress, asset, treasuryAddress)
	if err != nil {
		return nil, fmt.Errorf("خطا در محاسبه و تخمین گس از نود: %w", err)
	}

	bnbBal := gasEstimate.CurrentBNB
	usdtBal := gasEstimate.CurrentUSDT
	gasPriceGwei := gasEstimate.GasPriceGwei
	requiredGasUnits := gasEstimate.GasUnits
	gasFeeBNB := gasEstimate.TotalFeeBNB

	gasPriceWei := new(big.Int).Mul(big.NewInt(int64(gasPriceGwei*1e9)), big.NewInt(1))
	if gasPriceWei.Sign() == 0 {
		gasPriceWei = big.NewInt(3000000000) // 3 Gwei
	}

	logStep(1, "استعلام موجودی و تخمین گس زنده از نود BSC (Direct Node Check & Gas Estimation)",
		fmt.Sprintf("موجودی واقعی: %.6f BNB | %.4f USDT | نرخ گس: %.2f Gwei | تخمین گس تراکنش: %d واحد (کارمزد: %.6f BNB)",
			bnbBal, usdtBal, gasPriceGwei, requiredGasUnits, gasFeeBNB),
		"SUCCESS", "",
		fmt.Sprintf("RPC Node: %s | Target Wallet: %s | Gas Deficit: %.6f BNB", c.rpcURL, depositAddress, gasEstimate.DeficitBNB),
	)

	// 2. Strict Balance Verification & Live Gas Station Refueling!
	var refuelRequired bool
	var refuelTxHash string

	if asset == "USDT" {
		if usdtBal <= 0 {
			return nil, fmt.Errorf("موجودی تتر (BEP-20) والت در شبکه BSC صفر است (%.2f USDT). ابتدا باید تتر واقعی به آدرس %s واریز شود تا بتوان آن را ریبالانس کرد.", usdtBal, depositAddress)
		}
		if bnbBal < gasFeeBNB {
			// Child wallet lacks BNB for BEP-20 token transfer!
			// Check Master Gas Station Wallet (Index 0: Account 1 in MetaMask)
			masterGasAddr, err := c.hdManager.DeriveAddress(0)
			if err != nil {
				return nil, fmt.Errorf("خطا در اشتقاق آدرس والت سوخت‌رسان مستر: %w", err)
			}

			masterBNBBal, err := c.GetBNBBalance(ctx, masterGasAddr)
			if err != nil {
				return nil, fmt.Errorf("خطا در استعلام موجودی والت سوخت‌رسان مستر از نود: %w", err)
			}

			refuelDeficit := gasFeeBNB - bnbBal
			refuelAmountBNB := refuelDeficit
			if refuelAmountBNB < 0.00015 {
				refuelAmountBNB = 0.00015
			}
			gasForRefuelTx := 21000 * gasPriceGwei * 1e-9

			if masterBNBBal < (refuelAmountBNB + gasForRefuelTx) {
				return nil, fmt.Errorf("کسری موجودی والت مستر سوخت‌رسان (Gas Station): والت مستر (آدرس %s - اکانت ۱ متامسک) فاقد موجودی کافی BNB جهت سوخت‌رسانی به والت کاربر است (موجودی مستر: %.6f BNB | حداقل مورد نیاز: %.6f BNB). لطفاً ابتدا اکانت ۱ متامسک را با BNB شارژ کنید تا سیستم بتواند خودکار سوخت‌رسانی کند.", masterGasAddr, masterBNBBal, refuelAmountBNB+gasForRefuelTx)
			}

			// Master has enough BNB! Sign & broadcast real on-chain BNB transfer from Master to Child
			masterPrivHex, err := c.hdManager.DerivePrivateKey(0)
			if err != nil {
				return nil, fmt.Errorf("failed to derive master private key: %w", err)
			}
			masterECDSA, err := crypto.HexToECDSA(masterPrivHex)
			if err != nil {
				return nil, fmt.Errorf("failed to parse master private key: %w", err)
			}

			masterNonce, err := c.GetNonce(ctx, masterGasAddr)
			if err != nil {
				return nil, fmt.Errorf("failed to get master nonce: %w", err)
			}

			refuelWei, _ := new(big.Float).Mul(big.NewFloat(refuelAmountBNB), big.NewFloat(1e18)).Int(nil)
			refuelTx := types.NewTransaction(
				masterNonce,
				common.HexToAddress(depositAddress),
				refuelWei,
				21000,
				gasPriceWei,
				nil,
			)

			signer := types.NewEIP155Signer(big.NewInt(BSCChainID))
			signedRefuelTx, err := types.SignTx(refuelTx, signer, masterECDSA)
			if err != nil {
				return nil, fmt.Errorf("failed to sign gas station refuel transaction: %w", err)
			}

			signedRefuelBytes, err := signedRefuelTx.MarshalBinary()
			if err != nil {
				return nil, fmt.Errorf("failed to serialize refuel transaction: %w", err)
			}

			signedRefuelHex := "0x" + hex.EncodeToString(signedRefuelBytes)
			refuelTxHash, err = c.SendRawTransaction(ctx, signedRefuelHex)
			if err != nil {
				return nil, fmt.Errorf("خطا در ارسال تراکنش سوخت‌رسانی به نود BSC: %w", err)
			}

			refuelRequired = true
			logStep(len(logs)+1, "ایستگاه سوخت‌رسانی خودکار (Gas Station Refuel)",
				fmt.Sprintf("والت مستر صرافی (اکانت ۱ متامسک) مبلغ %.6f BNB جهت تامین گس توکن تتر به آدرس کاربر تزریق کرد.", refuelAmountBNB),
				"SUCCESS", refuelTxHash,
				fmt.Sprintf("Sender (Gas Station): %s -> Recipient: %s | Live On-Chain Tx", masterGasAddr, depositAddress),
			)

			// Wait up to 10 seconds for confirmation on BSC
			time.Sleep(3500 * time.Millisecond)
			for i := 0; i < 4; i++ {
				updatedBNB, _ := c.GetBNBBalance(ctx, depositAddress)
				if updatedBNB >= gasFeeBNB {
					bnbBal = updatedBNB
					break
				}
				time.Sleep(1500 * time.Millisecond)
			}
		}
	} else if asset == "BNB" {
		if bnbBal <= gasFeeBNB {
			return nil, fmt.Errorf("موجودی BNB والت (%.6f BNB) برای پوشش کارمزد شبکه (%.6f BNB) کافی نیست. حداقل موجودی باید بیشتر از کارمزد باشد.", bnbBal, gasFeeBNB)
		}
	}

	// 3. Step: Key Derivation in Volatile RAM
	childPrivKeyHex, err := c.hdManager.DerivePrivateKey(derivationIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to derive private key for index %d: %w", derivationIndex, err)
	}

	privKeyECDSA, err := crypto.HexToECDSA(childPrivKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ECDSA private key: %w", err)
	}

	derivationPath := fmt.Sprintf("m/44'/60'/0'/0/%d", derivationIndex)
	maskedKey := childPrivKeyHex[:6] + "..." + childPrivKeyHex[len(childPrivKeyHex)-6:]

	logStep(len(logs)+1, "استخراج کلید خصوصی در رم (Deterministic Key Derivation)",
		fmt.Sprintf("کلید خصوصی از مسیر %s در حافظه موقت محاسبه شد (عدم ذخیره در دیتابیس).", derivationPath),
		"SUCCESS", "",
		fmt.Sprintf("Derived Key: %s | Algorithm: ECDSA secp256k1", maskedKey),
	)

	// 4. Step 3: Construct & Sign Real EVM Transaction
	nonce, err := c.GetNonce(ctx, depositAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce from node: %w", err)
	}

	signer := types.NewEIP155Signer(big.NewInt(BSCChainID))
	var signedTx *types.Transaction
	var amountSwept float64

	if asset == "BNB" {
		totalWei, err := c.GetBNBBalanceWei(ctx, depositAddress)
		if err != nil {
			return nil, fmt.Errorf("خطا در استعلام موجودی آنچین BNB: %w", err)
		}
		feeWei := new(big.Int).Mul(gasPriceWei, big.NewInt(int64(requiredGasUnits)))
		if totalWei.Cmp(feeWei) <= 0 {
			return nil, fmt.Errorf("موجودی BNB والت برای پوشش کارمزد شبکه کافی نیست")
		}
		transferWei := new(big.Int).Sub(totalWei, feeWei)
		transferFloat := new(big.Float).Quo(new(big.Float).SetInt(transferWei), big.NewFloat(1e18))
		amountSwept, _ = transferFloat.Float64()

		tx := types.NewTransaction(
			nonce,
			common.HexToAddress(treasuryAddress),
			transferWei,
			requiredGasUnits,
			gasPriceWei,
			nil,
		)

		signedTx, err = types.SignTx(tx, signer, privKeyECDSA)
		if err != nil {
			return nil, fmt.Errorf("failed to sign BNB transaction: %w", err)
		}
	} else {
		// BEP-20 USDT transfer: method transfer(address,uint256) -> selector 0xa9059cbb
		tokenWei, err := c.GetUSDTBalanceWei(ctx, depositAddress)
		if err != nil || tokenWei.Sign() == 0 {
			return nil, fmt.Errorf("موجودی تتر والت صفر است")
		}
		tokenFloat := new(big.Float).Quo(new(big.Float).SetInt(tokenWei), big.NewFloat(1e18))
		amountSwept, _ = tokenFloat.Float64()

		toAddr := common.HexToAddress(treasuryAddress)
		var data []byte
		data = append(data, common.Hex2Bytes("a9059cbb")...)
		data = append(data, common.LeftPadBytes(toAddr.Bytes(), 32)...)
		data = append(data, common.LeftPadBytes(tokenWei.Bytes(), 32)...)

		tx := types.NewTransaction(
			nonce,
			common.HexToAddress(USDTContractBSC),
			big.NewInt(0),
			requiredGasUnits,
			gasPriceWei,
			data,
		)

		signedTx, err = types.SignTx(tx, signer, privKeyECDSA)
		if err != nil {
			return nil, fmt.Errorf("failed to sign BEP-20 USDT transaction: %w", err)
		}
	}

	signedTxBytes, err := signedTx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to serialize signed transaction: %w", err)
	}
	signedTxHex := "0x" + hex.EncodeToString(signedTxBytes)
	realTxHash := signedTx.Hash().Hex()

	logStep(len(logs)+1, "تولید و امضای تراکنش خام محلی (Local Transaction Signing)",
		fmt.Sprintf("تراکنش واقعی انتقال %s ساخته شده و با الگوریتم EIP-155 در شبکه بایننس (Chain ID 56) امضا شد.", asset),
		"SUCCESS", realTxHash,
		fmt.Sprintf("Nonce: %d | Gas Limit: %d | Value: %.4f %s", nonce, requiredGasUnits, amountSwept, asset),
	)

	// 5. Step: Real Broadcast or Dry-Run
	statusStr := "PREFLIGHT_VERIFIED"
	descBroadcast := fmt.Sprintf("تراکنش انتقال واقعی با موفقیت امضا و آماده برادکست به نود گردید (هش تراکنش معتبر: %s).", realTxHash)

	if realBroadcast {
		broadcastHash, err := c.SendRawTransaction(ctx, signedTxHex)
		if err != nil {
			return nil, fmt.Errorf("خطا در ارسال مستقیم تراکنش به نود BSC: %w", err)
		}
		realTxHash = broadcastHash
		statusStr = "BROADCASTED_LIVE"
		descBroadcast = fmt.Sprintf("تراکنش واقعی انتقال %s با موفقیت به نود بایننس ارسال شد و در بلاکچین ثبت گردید.", asset)
	}

	logStep(len(logs)+1, "ارسال به نود بایننس اسمارت چین (Direct RPC Broadcast)",
		descBroadcast,
		statusStr, realTxHash,
		fmt.Sprintf("Destination: %s | Hash: %s", treasuryAddress, realTxHash),
	)

	return &domain.SweepResult{
		DerivationIndex: derivationIndex,
		DepositAddress:  depositAddress,
		TreasuryAddress: treasuryAddress,
		AssetSwept:      asset,
		AmountSwept:     amountSwept,
		GasFeeBNB:       gasFeeBNB,
		RefuelRequired:  refuelRequired,
		RefuelTxHash:    refuelTxHash,
		SweepTxHash:     realTxHash,
		IsBroadcasted:   realBroadcast,
		Logs:            logs,
		ExecutedAt:      time.Now(),
	}, nil
}
