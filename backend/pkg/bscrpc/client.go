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
	DefaultBSCRPC        = "https://bsc-dataseed.binance.org"
	DefaultBSCTestnetRPC = "https://bsc-testnet.publicnode.com"
	USDTContractBSC      = "0x55d398326f99059fF775485246999027B3197955"
	USDTContractBSCTest  = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"

	DefaultETHRPC        = "https://eth.llamarpc.com"
	DefaultETHTestnetRPC = "https://ethereum-sepolia.publicnode.com"
	USDTContractETH      = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
	USDTContractETHTest  = "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0"

	DefaultTreasury   = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" // Master Treasury fallback
	BSCChainID        = 56                                          // BNB Smart Chain Mainnet
	BSCTestnetChainID = 97                                          // BNB Smart Chain Testnet
	ETHChainID        = 1                                           // Ethereum Mainnet
	ETHTestnetChainID = 11155111                                    // Ethereum Sepolia Testnet
)

type Client struct {
	networkID    string
	nativeSymbol string
	rpcURL       string
	httpClient   *http.Client
	hdManager    *hdwallet.Manager
	chainID      *big.Int
	usdtContract string
	usdtDecimals int
	isTestnet    bool
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

// NewEVMClient creates an EVM JSON-RPC client for BSC or Ethereum
func NewEVMClient(networkID string, rpcURL string, hdManager *hdwallet.Manager, isTestnet ...bool) *Client {
	testnet := len(isTestnet) > 0 && isTestnet[0]
	netID := strings.ToLower(strings.TrimSpace(networkID))
	if netID == "" {
		netID = "bsc"
	}

	var defaultRPC string
	var chainID *big.Int
	var usdtAddr string
	var nativeSymbol string
	var usdtDecimals int

	if netID == "eth" {
		nativeSymbol = "ETH"
		usdtDecimals = 6
		if testnet {
			defaultRPC = DefaultETHTestnetRPC
			chainID = big.NewInt(ETHTestnetChainID)
			usdtAddr = USDTContractETHTest
		} else {
			defaultRPC = DefaultETHRPC
			chainID = big.NewInt(ETHChainID)
			usdtAddr = USDTContractETH
		}
	} else {
		netID = "bsc"
		nativeSymbol = "BNB"
		usdtDecimals = 18
		if testnet {
			defaultRPC = DefaultBSCTestnetRPC
			chainID = big.NewInt(BSCTestnetChainID)
			usdtAddr = USDTContractBSCTest
		} else {
			defaultRPC = DefaultBSCRPC
			chainID = big.NewInt(BSCChainID)
			usdtAddr = USDTContractBSC
		}
	}

	if rpcURL == "" {
		rpcURL = defaultRPC
	}
	return &Client{
		networkID:    netID,
		nativeSymbol: nativeSymbol,
		rpcURL:       rpcURL,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		hdManager:    hdManager,
		chainID:      chainID,
		usdtContract: usdtAddr,
		usdtDecimals: usdtDecimals,
		isTestnet:    testnet,
	}
}

// NewClient creates a BSC RPC client for backward compatibility
func NewClient(rpcURL string, hdManager *hdwallet.Manager, isTestnet ...bool) *Client {
	return NewEVMClient("bsc", rpcURL, hdManager, isTestnet...)
}

func (c *Client) NetworkID() string {
	return c.networkID
}

func (c *Client) NativeSymbol() string {
	return c.nativeSymbol
}

func (c *Client) IsTestnet() bool {
	return c.isTestnet
}

func (c *Client) ChainID() *big.Int {
	return c.chainID
}

func (c *Client) USDTContract() string {
	return c.usdtContract
}

func (c *Client) USDTDecimals() int {
	return c.usdtDecimals
}

// callRPC sends a JSON-RPC request directly to the EVM node
func (c *Client) callRPC(ctx context.Context, method string, params []interface{}) (json.RawMessage, error) {
	reqBody := rpcRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	payloadBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON-RPC request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.rpcURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("rpc connection error to %s: %w", c.rpcURL, err)
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("failed to decode rpc response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error code %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// GetNativeBalanceWei fetches the raw native (BNB or ETH) balance in Wei as *big.Int
func (c *Client) GetNativeBalanceWei(ctx context.Context, address string) (*big.Int, error) {
	raw, err := c.callRPC(ctx, "eth_getBalance", []interface{}{address, "finalized"})
	if err != nil {
		raw, err = c.callRPC(ctx, "eth_getBalance", []interface{}{address, "latest"})
		if err != nil {
			return nil, err
		}
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return nil, err
	}

	hexClean := strings.TrimPrefix(hexStr, "0x")
	if hexClean == "" {
		return big.NewInt(0), nil
	}

	val, ok := new(big.Int).SetString(hexClean, 16)
	if !ok {
		return nil, fmt.Errorf("failed to parse hex balance: %s", hexStr)
	}
	return val, nil
}

// GetBNBBalanceWei alias for backward compatibility
func (c *Client) GetBNBBalanceWei(ctx context.Context, address string) (*big.Int, error) {
	return c.GetNativeBalanceWei(ctx, address)
}

// GetNativeBalance returns human-readable balance in native token (BNB or ETH)
func (c *Client) GetNativeBalance(ctx context.Context, address string) (float64, error) {
	raw, err := c.GetNativeBalanceWei(ctx, address)
	if err != nil {
		return 0, err
	}

	f := new(big.Float).SetInt(raw)
	res, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
	return res, nil
}

// GetBNBBalance alias for backward compatibility
func (c *Client) GetBNBBalance(ctx context.Context, address string) (float64, error) {
	return c.GetNativeBalance(ctx, address)
}

// GetUSDTBalanceWei fetches the raw USDT token balance in Wei as *big.Int
func (c *Client) GetUSDTBalanceWei(ctx context.Context, address string) (*big.Int, error) {
	cleanAddr := strings.ToLower(strings.TrimPrefix(address, "0x"))
	if len(cleanAddr) != 40 {
		return nil, fmt.Errorf("invalid evm address format: %s", address)
	}

	callData := "0x70a08231" + fmt.Sprintf("%064s", cleanAddr)
	callObj := map[string]string{
		"to":   c.usdtContract,
		"data": callData,
	}

	raw, err := c.callRPC(ctx, "eth_call", []interface{}{callObj, "finalized"})
	if err != nil {
		raw, err = c.callRPC(ctx, "eth_call", []interface{}{callObj, "latest"})
		if err != nil {
			return nil, err
		}
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return nil, err
	}

	hexClean := strings.TrimPrefix(hexStr, "0x")
	if hexClean == "" {
		return big.NewInt(0), nil
	}

	val, ok := new(big.Int).SetString(hexClean, 16)
	if !ok {
		return nil, fmt.Errorf("failed to parse token balance hex: %s", hexStr)
	}
	return val, nil
}

// GetUSDTBalance fetches the human-readable BEP-20 / ERC-20 USDT token balance
func (c *Client) GetUSDTBalance(ctx context.Context, address string) (float64, error) {
	raw, err := c.GetUSDTBalanceWei(ctx, address)
	if err != nil {
		return 0, err
	}

	f := new(big.Float).SetInt(raw)
	divisor := big.NewFloat(1e18)
	if c.usdtDecimals == 6 {
		divisor = big.NewFloat(1e6)
	}
	res, _ := new(big.Float).Quo(f, divisor).Float64()
	return res, nil
}

// GetNonce returns the current transaction count for an address
func (c *Client) GetNonce(ctx context.Context, address string) (uint64, error) {
	raw, err := c.callRPC(ctx, "eth_getTransactionCount", []interface{}{address, "latest"})
	if err != nil {
		return 0, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return 0, err
	}

	val, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return 0, fmt.Errorf("failed to parse hex nonce: %s", hexStr)
	}
	return val.Uint64(), nil
}

// GetGasPrice returns the current gas price in Gwei
func (c *Client) GetGasPrice(ctx context.Context) (float64, error) {
	raw, err := c.callRPC(ctx, "eth_gasPrice", []interface{}{})
	if err != nil {
		return 0, err
	}

	var hexStr string
	if err := json.Unmarshal(raw, &hexStr); err != nil {
		return 0, err
	}

	val, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return 0, fmt.Errorf("failed to parse hex gas price: %s", hexStr)
	}

	f := new(big.Float).SetInt(val)
	gwei, _ := new(big.Float).Quo(f, big.NewFloat(1e9)).Float64()
	return gwei, nil
}

// EstimateGas estimates units of gas needed for a call
func (c *Client) EstimateGas(ctx context.Context, from, to string, data []byte, value *big.Int) (uint64, error) {
	callObj := map[string]string{
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

// EstimateSweepGas queries the live node for gasPrice, estimates gasUnits, and calculates exact refuel needs
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
	if asset != c.nativeSymbol {
		asset = "USDT"
	}

	gasPriceGwei, err := c.GetGasPrice(ctx)
	if err != nil {
		if c.networkID == "eth" {
			gasPriceGwei = 20.0
		} else {
			gasPriceGwei = 3.0
		}
	}

	nativeBal, _ := c.GetNativeBalance(ctx, depositAddress)
	usdtBal, _ := c.GetUSDTBalance(ctx, depositAddress)

	var gasUnits uint64 = 21000
	if asset == "USDT" {
		toAddr := common.HexToAddress(treasuryAddress)
		var data []byte
		data = append(data, common.Hex2Bytes("a9059cbb")...)
		data = append(data, common.LeftPadBytes(toAddr.Bytes(), 32)...)
		data = append(data, common.LeftPadBytes(big.NewInt(1000000).Bytes(), 32)...)

		estUnits, estErr := c.EstimateGas(ctx, depositAddress, c.usdtContract, data, nil)
		if estErr == nil && estUnits > 0 {
			gasUnits = estUnits
		} else {
			gasUnits = 65000
		}
	}

	totalFee := float64(gasUnits) * gasPriceGwei * 1e-9
	deficit := 0.0
	needsRefuel := false

	if nativeBal < totalFee {
		deficit = totalFee - nativeBal
		needsRefuel = true
	}

	return &domain.GasEstimateResult{
		Asset:          asset,
		DepositAddress: depositAddress,
		GasUnits:       gasUnits,
		GasPriceGwei:   gasPriceGwei,
		TotalFeeBNB:    totalFee,
		CurrentBNB:     nativeBal,
		CurrentUSDT:    usdtBal,
		DeficitBNB:     deficit,
		NeedsRefuel:    needsRefuel,
		EstimatedAt:    time.Now(),
	}, nil
}

// SendRawTransaction broadcasts an already signed raw transaction hex to the node
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

// ExecuteOrSimulateSweep executes REAL on-chain sweeping with support for Multi-Vault Many-to-Many split transfers
func (c *Client) ExecuteOrSimulateSweep(
	ctx context.Context,
	derivationIndex int,
	depositAddress string,
	asset string,
	treasuryAddress string,
	optionalMnemonic string,
	vaultSplits []domain.VaultSplit,
) (*domain.SweepResult, error) {
	asset = strings.ToUpper(strings.TrimSpace(asset))
	if asset != c.nativeSymbol && asset != "USDT" {
		asset = "USDT"
	}

	// Normalize destination vaults
	var activeSplits []domain.VaultSplit
	if len(vaultSplits) > 0 {
		activeSplits = vaultSplits
	} else {
		if treasuryAddress == "" {
			treasuryAddress = DefaultTreasury
		}
		activeSplits = []domain.VaultSplit{
			{Address: treasuryAddress, Percentage: 100.0, Label: "خزانه اصلی خزانه‌داری"},
		}
	}

	primaryTreasury := activeSplits[0].Address

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

	// 1. Step 1: Query live on-chain balances and estimate gas dynamically from the node
	gasEstimate, err := c.EstimateSweepGas(ctx, depositAddress, asset, primaryTreasury)
	if err != nil {
		return nil, fmt.Errorf("خطا در محاسبه و استعلام موجودی از نود %s: %w", strings.ToUpper(c.networkID), err)
	}

	nativeBal := gasEstimate.CurrentBNB
	usdtBal := gasEstimate.CurrentUSDT
	gasPriceGwei := gasEstimate.GasPriceGwei
	requiredGasUnits := gasEstimate.GasUnits
	gasFeePerTx := gasEstimate.TotalFeeBNB

	gasPriceWei := new(big.Int).Mul(big.NewInt(int64(gasPriceGwei*1e9)), big.NewInt(1))
	if gasPriceWei.Sign() == 0 {
		gasPriceWei = big.NewInt(3000000000) // 3 Gwei
	}

	logStep(1, fmt.Sprintf("استعلام موجودی و تخمین گس زنده از نود %s", strings.ToUpper(c.networkID)),
		fmt.Sprintf("موجودی: %.6f %s | %.4f USDT | نرخ گس: %.2f Gwei | تعداد خزانه‌های مقصد: %d",
			nativeBal, c.nativeSymbol, usdtBal, gasPriceGwei, len(activeSplits)),
		"SUCCESS", "",
		fmt.Sprintf("Node: %s | Target Wallet: %s", c.rpcURL, depositAddress),
	)

	// 2. Gas Station Refueling if needed
	var refuelRequired bool
	var refuelTxHash string

	totalGasRequired := gasFeePerTx * float64(len(activeSplits))

	if asset == "USDT" {
		if usdtBal <= 0 {
			return nil, fmt.Errorf("موجودی تتر این ولت در بلاکچین صفر است (%.4f USDT). برای سوئیپ، ابتدا باید تتر به آدرس %s واریز شده باشد.", usdtBal, depositAddress)
		}

		if nativeBal < totalGasRequired {
			// Gas Station Refuel from Index 0
			masterGasAddr, err := c.hdManager.DeriveAddress(0)
			if err != nil {
				return nil, fmt.Errorf("خطا در اشتقاق آدرس ولت سوخت‌رسان مستر: %w", err)
			}

			masterNativeBal, err := c.GetNativeBalance(ctx, masterGasAddr)
			if err != nil {
				masterNativeBal = 0.0
			}

			refuelDeficit := totalGasRequired - nativeBal
			refuelAmount := refuelDeficit
			if refuelAmount < 0.0003 {
				refuelAmount = 0.0003
			}
			gasForRefuelTx := 21000 * gasPriceGwei * 1e-9

			if masterNativeBal < (refuelAmount + gasForRefuelTx) {
				return nil, fmt.Errorf("کسری موجودی ولت سوخت‌رسان (Gas Station): ولت تنخواه مستر (آدرس %s) فاقد موجودی کافی %s جهت سوخت‌رسانی است (موجودی: %.6f %s | مورد نیاز: %.6f). لطفاً ولت مستر را شارژ کنید.", masterGasAddr, c.nativeSymbol, masterNativeBal, c.nativeSymbol, refuelAmount+gasForRefuelTx)
			}

			var masterPrivHex string
			if optionalMnemonic != "" {
				masterPrivHex, err = c.hdManager.DerivePrivateKeyWithMnemonic(optionalMnemonic, 0)
			} else {
				masterPrivHex, err = c.hdManager.DerivePrivateKey(0)
			}
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

			refuelWei, _ := new(big.Float).Mul(big.NewFloat(refuelAmount), big.NewFloat(1e18)).Int(nil)
			refuelTx := types.NewTransaction(
				masterNonce,
				common.HexToAddress(depositAddress),
				refuelWei,
				21000,
				gasPriceWei,
				nil,
			)

			signer := types.NewEIP155Signer(c.chainID)
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
				return nil, fmt.Errorf("خطا در ارسال تراکنش سوخت‌رسانی به نود: %w", err)
			}

			refuelRequired = true
			logStep(len(logs)+1, fmt.Sprintf("ایستگاه سوخت‌رسانی خودکار (%s Gas Station)", c.nativeSymbol),
				fmt.Sprintf("مبلغ %.6f %s جهت تامین کارمزد %d تراکنش تسهیم تزریق گردید.", refuelAmount, c.nativeSymbol, len(activeSplits)),
				"SUCCESS", refuelTxHash,
				fmt.Sprintf("Gas Station: %s -> User: %s", masterGasAddr, depositAddress),
			)

			// Wait up to 8 seconds for confirmation
			time.Sleep(3000 * time.Millisecond)
			for i := 0; i < 4; i++ {
				updatedNative, _ := c.GetNativeBalance(ctx, depositAddress)
				if updatedNative >= totalGasRequired {
					nativeBal = updatedNative
					break
				}
				time.Sleep(1200 * time.Millisecond)
			}
		}
	} else {
		// Native Asset (BNB or ETH)
		if nativeBal <= totalGasRequired {
			return nil, fmt.Errorf("موجودی %s ولت (%.6f) برای پوشش کارمزد تراکنش‌ها (%.6f) کافی نیست.", c.nativeSymbol, nativeBal, totalGasRequired)
		}
	}

	// 3. Step: Key Derivation in Volatile RAM
	var childPrivKeyHex string
	if optionalMnemonic != "" {
		childPrivKeyHex, err = c.hdManager.DerivePrivateKeyWithMnemonic(optionalMnemonic, derivationIndex)
	} else {
		childPrivKeyHex, err = c.hdManager.DerivePrivateKey(derivationIndex)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to derive private key for index %d: %w", derivationIndex, err)
	}

	privKeyECDSA, err := crypto.HexToECDSA(childPrivKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ECDSA private key: %w", err)
	}

	maskedKey := childPrivKeyHex[:6] + "..." + childPrivKeyHex[len(childPrivKeyHex)-6:]
	logStep(len(logs)+1, "اشتقاق کلید خصوصی در RAM موقت (Deterministic RAM-Only Derivation)",
		"کلید با استاندارد secp256k1 صرفاً در حافظه موقت مشتق شد (امنیت Zero-Key).",
		"SUCCESS", "",
		fmt.Sprintf("Derived Key: %s", maskedKey),
	)

	// 4. Step: Multi-Vault Many-to-Many Split Execution
	nonce, err := c.GetNonce(ctx, depositAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce from node: %w", err)
	}

	signer := types.NewEIP155Signer(c.chainID)
	var splitResults []domain.SplitTransferResult
	var lastTxHash string
	var totalSwept float64

	if asset == c.nativeSymbol {
		totalWei, err := c.GetNativeBalanceWei(ctx, depositAddress)
		if err != nil {
			return nil, fmt.Errorf("failed to get native balance: %w", err)
		}
		feeWeiTotal := new(big.Int).Mul(gasPriceWei, big.NewInt(int64(requiredGasUnits*uint64(len(activeSplits)))))
		if totalWei.Cmp(feeWeiTotal) <= 0 {
			return nil, fmt.Errorf("موجودی برای پوشش کارمزد تراکنش‌ها کافی نیست")
		}
		distributableWei := new(big.Int).Sub(totalWei, feeWeiTotal)
		remainingWei := new(big.Int).Set(distributableWei)

		for i, split := range activeSplits {
			var sendWei *big.Int
			if i == len(activeSplits)-1 {
				sendWei = remainingWei
			} else {
				pctInt := int64(split.Percentage * 100)
				sendWei = new(big.Int).Div(new(big.Int).Mul(distributableWei, big.NewInt(pctInt)), big.NewInt(10000))
				remainingWei = new(big.Int).Sub(remainingWei, sendWei)
			}

			sendFloat, _ := new(big.Float).Quo(new(big.Float).SetInt(sendWei), big.NewFloat(1e18)).Float64()

			tx := types.NewTransaction(
				nonce,
				common.HexToAddress(split.Address),
				sendWei,
				requiredGasUnits,
				gasPriceWei,
				nil,
			)

			signedTx, err := types.SignTx(tx, signer, privKeyECDSA)
			if err != nil {
				return nil, fmt.Errorf("failed to sign native tx for vault %s: %w", split.Address, err)
			}

			signedBytes, err := signedTx.MarshalBinary()
			if err != nil {
				return nil, fmt.Errorf("failed to serialize tx: %w", err)
			}

			txHash, err := c.SendRawTransaction(ctx, "0x"+hex.EncodeToString(signedBytes))
			if err != nil {
				return nil, fmt.Errorf("خطا در ارسال تراکنش تسهیم به خزانه %s: %w", split.Address, err)
			}

			lastTxHash = txHash
			totalSwept += sendFloat
			splitResults = append(splitResults, domain.SplitTransferResult{
				VaultAddress: split.Address,
				Label:        split.Label,
				Percentage:   split.Percentage,
				Amount:       sendFloat,
				TxHash:       txHash,
			})

			logStep(len(logs)+1, fmt.Sprintf("تسهیم آنچین به %s (%.0f%%)", split.Label, split.Percentage),
				fmt.Sprintf("مبلغ %.6f %s با موفقیت به %s واریز شد.", sendFloat, c.nativeSymbol, split.Address),
				"SUCCESS", txHash,
				fmt.Sprintf("Tx Hash: %s", txHash),
			)

			nonce++
		}
	} else {
		// USDT Transfer
		tokenWei, err := c.GetUSDTBalanceWei(ctx, depositAddress)
		if err != nil || tokenWei.Sign() == 0 {
			return nil, fmt.Errorf("موجودی تتر ولت در بلاکچین صفر است")
		}

		divisor := big.NewFloat(1e18)
		if c.usdtDecimals == 6 {
			divisor = big.NewFloat(1e6)
		}
		totalUSDTFloat, _ := new(big.Float).Quo(new(big.Float).SetInt(tokenWei), divisor).Float64()
		remainingTokenWei := new(big.Int).Set(tokenWei)

		for i, split := range activeSplits {
			var sendTokenWei *big.Int
			if i == len(activeSplits)-1 {
				sendTokenWei = remainingTokenWei
			} else {
				pctInt := int64(split.Percentage * 100)
				sendTokenWei = new(big.Int).Div(new(big.Int).Mul(tokenWei, big.NewInt(pctInt)), big.NewInt(10000))
				remainingTokenWei = new(big.Int).Sub(remainingTokenWei, sendTokenWei)
			}

			sendFloat, _ := new(big.Float).Quo(new(big.Float).SetInt(sendTokenWei), divisor).Float64()

			toAddr := common.HexToAddress(split.Address)
			var data []byte
			data = append(data, common.Hex2Bytes("a9059cbb")...)
			data = append(data, common.LeftPadBytes(toAddr.Bytes(), 32)...)
			data = append(data, common.LeftPadBytes(sendTokenWei.Bytes(), 32)...)

			tx := types.NewTransaction(
				nonce,
				common.HexToAddress(c.usdtContract),
				big.NewInt(0),
				requiredGasUnits,
				gasPriceWei,
				data,
			)

			signedTx, err := types.SignTx(tx, signer, privKeyECDSA)
			if err != nil {
				return nil, fmt.Errorf("failed to sign USDT tx for vault %s: %w", split.Address, err)
			}

			signedBytes, err := signedTx.MarshalBinary()
			if err != nil {
				return nil, fmt.Errorf("failed to serialize tx: %w", err)
			}

			txHash, err := c.SendRawTransaction(ctx, "0x"+hex.EncodeToString(signedBytes))
			if err != nil {
				return nil, fmt.Errorf("خطا در ارسال تراکنش تتر به خزانه %s: %w", split.Address, err)
			}

			lastTxHash = txHash
			totalSwept += sendFloat
			splitResults = append(splitResults, domain.SplitTransferResult{
				VaultAddress: split.Address,
				Label:        split.Label,
				Percentage:   split.Percentage,
				Amount:       sendFloat,
				TxHash:       txHash,
			})

			logStep(len(logs)+1, fmt.Sprintf("تسهیم تتر به %s (%.0f%%)", split.Label, split.Percentage),
				fmt.Sprintf("مبلغ %.4f USDT با موفقیت به %s منتقل شد.", sendFloat, split.Address),
				"SUCCESS", txHash,
				fmt.Sprintf("Tx Hash: %s", txHash),
			)

			nonce++
		}
		totalSwept = totalUSDTFloat
	}

	return &domain.SweepResult{
		NetworkID:       c.networkID,
		DerivationIndex: derivationIndex,
		DepositAddress:  depositAddress,
		TreasuryAddress: primaryTreasury,
		AssetSwept:      asset,
		AmountSwept:     totalSwept,
		GasFeeBNB:       totalGasRequired,
		RefuelRequired:  refuelRequired,
		RefuelTxHash:    refuelTxHash,
		SweepTxHash:     lastTxHash,
		IsBroadcasted:   true,
		Splits:          splitResults,
		Logs:            logs,
		ExecutedAt:      time.Now(),
	}, nil
}
