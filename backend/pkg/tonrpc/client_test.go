package tonrpc

import (
	"context"
	"testing"
	"time"
)

func TestTonClient_GetBalance(t *testing.T) {
	client := NewClient("", "")
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	testAddr := "UQCoIO3NMFAZJnXOPdlZqCrahKRiGBB8I6fSaa4ij6qKquQw"
	balance, err := client.GetBalance(ctx, testAddr)
	if err != nil {
		t.Fatalf("failed to get TON balance: %v", err)
	}

	if balance < 0 {
		t.Errorf("expected non-negative balance, got %f", balance)
	}
	t.Logf("TON Treasury Wallet balance: %f TON", balance)
}

func TestTonClient_GetTransactions(t *testing.T) {
	client := NewClient("", "")
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	testAddr := "UQCoIO3NMFAZJnXOPdlZqCrahKRiGBB8I6fSaa4ij6qKquQw"
	txs, err := client.GetTransactions(ctx, testAddr, 5)
	if err != nil {
		t.Fatalf("failed to get transactions: %v", err)
	}

	if len(txs) == 0 {
		t.Errorf("expected at least 1 transaction, got 0")
	}
	t.Logf("Fetched %d transactions successfully. First tx hash: %s", len(txs), txs[0].TransactionID.Hash)
}
