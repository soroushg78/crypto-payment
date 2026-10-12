package tonrpc

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultToncenterURL = "https://toncenter.com/api/v2"
)

// InMsg represents the inbound message payload in Toncenter v2 API
type InMsg struct {
	Source      string   `json:"source"`
	Destination string   `json:"destination"`
	Value       string   `json:"value"` // nanoTONs as string
	Message     string   `json:"message"`
	MsgData     *MsgData `json:"msg_data"`
}

type MsgData struct {
	Type string `json:"@type"`
	Text string `json:"text"` // plain-text or base64
}

type TransactionID struct {
	LT   string `json:"lt"`
	Hash string `json:"hash"`
}

type Transaction struct {
	UTime         int64         `json:"utime"`
	TransactionID TransactionID `json:"transaction_id"`
	InMsg         *InMsg        `json:"in_msg"`
}

type ToncenterResponse struct {
	Ok     bool          `json:"ok"`
	Result []Transaction `json:"result"`
	Error  string        `json:"error"`
}

type TonBalanceResponse struct {
	Ok     bool   `json:"ok"`
	Result string `json:"result"` // nanoTONs string
	Error  string `json:"error"`
}

type PaymentMatch struct {
	TxHash      string    `json:"tx_hash"`
	FromAddress string    `json:"from_address"`
	Amount      float64   `json:"amount"` // in TON
	Memo        string    `json:"memo"`
	Timestamp   time.Time `json:"timestamp"`
}

type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewClient initializes a TON blockchain RPC/REST client
func NewClient(baseURL, apiKey string) *Client {
	if baseURL == "" {
		baseURL = DefaultToncenterURL
	}
	baseURL = strings.TrimRight(baseURL, "/")
	return &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: baseURL,
		apiKey:  apiKey,
	}
}

// ExtractMemo decodes the human-readable text comment or memo from the inbound message
func (c *Client) ExtractMemo(msg *InMsg) string {
	if msg == nil {
		return ""
	}
	if msg.Message != "" {
		return strings.TrimSpace(msg.Message)
	}
	if msg.MsgData != nil && msg.MsgData.Text != "" {
		decoded, err := base64.StdEncoding.DecodeString(msg.MsgData.Text)
		if err == nil && len(decoded) > 0 {
			return strings.TrimSpace(string(decoded))
		}
		return strings.TrimSpace(msg.MsgData.Text)
	}
	return ""
}

// GetTransactions queries the latest transactions for a TON address from Toncenter
func (c *Client) GetTransactions(ctx context.Context, address string, limit int) ([]Transaction, error) {
	if limit <= 0 {
		limit = 20
	}
	reqURL := fmt.Sprintf("%s/getTransactions?address=%s&limit=%d", c.baseURL, address, limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create TON RPC request: %w", err)
	}

	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("TON RPC request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read TON RPC response: %w", err)
	}

	var res ToncenterResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("failed to parse TON RPC JSON: %w", err)
	}

	if !res.Ok {
		return nil, fmt.Errorf("TON RPC returned error: %s", res.Error)
	}

	return res.Result, nil
}

// GetBalance returns the balance in TON (float64) for a given address
func (c *Client) GetBalance(ctx context.Context, address string) (float64, error) {
	reqURL := fmt.Sprintf("%s/getAddressBalance?address=%s", c.baseURL, address)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("TON balance request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response: %w", err)
	}

	var res TonBalanceResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return 0, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if !res.Ok {
		return 0, fmt.Errorf("TON balance error: %s", res.Error)
	}

	nanoVal, err := strconv.ParseFloat(res.Result, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid balance value: %w", err)
	}

	return nanoVal / 1e9, nil
}

// CheckPayment verifies if an inbound transfer with matching memo and amount occurred on-chain
func (c *Client) CheckPayment(ctx context.Context, address string, expectedMemo string, expectedAmount float64, invoiceCreatedAt time.Time) (*PaymentMatch, error) {
	txs, err := c.GetTransactions(ctx, address, 40)
	if err != nil {
		return nil, err
	}

	cleanExpectedMemo := strings.TrimSpace(strings.ToUpper(expectedMemo))

	for _, tx := range txs {
		if tx.InMsg == nil {
			continue
		}

		// Verify transaction timestamp (at or after invoice created - allow 2 minutes buffer)
		txTime := time.Unix(tx.UTime, 0)
		if txTime.Before(invoiceCreatedAt.Add(-2 * time.Minute)) {
			continue
		}

		// Parse value in nanoTONs
		nanoVal, err := strconv.ParseFloat(tx.InMsg.Value, 64)
		if err != nil || nanoVal <= 0 {
			continue
		}
		tonAmount := nanoVal / 1e9

		// Compare memo
		memo := c.ExtractMemo(tx.InMsg)
		cleanMemo := strings.TrimSpace(strings.ToUpper(memo))

		if cleanMemo == cleanExpectedMemo {
			// Threshold: 98% of expected crypto amount to allow minor rounding
			if tonAmount >= expectedAmount*0.98 {
				return &PaymentMatch{
					TxHash:      tx.TransactionID.Hash,
					FromAddress: tx.InMsg.Source,
					Amount:      tonAmount,
					Memo:        memo,
					Timestamp:   txTime,
				}, nil
			}
		}
	}

	return nil, nil
}
