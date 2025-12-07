"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface SpendingControl {
  id: string;
  wallet_address: string;
  daily_limit: number | null;
  monthly_limit: number | null;
  whitelist_merchants: string[];
  time_restrictions: Record<string, any>;
}

export function SpendingControls() {
  const account = useActiveAccount();
  const address = account?.address;
  const [controls, setControls] = useState<SpendingControl | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [merchants, setMerchants] = useState("");

  useEffect(() => {
    if (address) {
      fetchControls();
    }
  }, [address]);

  const fetchControls = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/x402/spending-controls/${address}`);
      if (res.ok) {
        const data = await res.json();
        setControls(data);
        setDailyLimit(data.daily_limit?.toString() || "");
        setMonthlyLimit(data.monthly_limit?.toString() || "");
        setMerchants(data.whitelist_merchants?.join(", ") || "");
      } else if (res.status === 404) {
        // 404 is expected when no controls exist yet - handle silently
        setControls(null);
        setDailyLimit("");
        setMonthlyLimit("");
        setMerchants("");
      } else {
        // Only log unexpected errors
        const errorData = await res.json().catch(() => ({}));
        console.error("Error fetching spending controls:", errorData.detail || res.statusText);
      }
    } catch (error) {
      // Only log network errors or other unexpected errors
      console.error("Error fetching spending controls:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveControls = async () => {
    if (!address) return;
    setSaving(true);
    try {
      const whitelist = merchants.split(",").map(m => m.trim()).filter(m => m);
      const res = await fetch(`${API_BASE_URL}/x402/spending-controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: address,
          daily_limit: dailyLimit ? parseFloat(dailyLimit) : null,
          monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
          whitelist_merchants: whitelist.length > 0 ? whitelist : null,
        }),
      });
      if (res.ok) {
        await fetchControls();
        alert("Spending controls saved successfully!");
      } else {
        const error = await res.json();
        alert(`Failed to save: ${error.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving controls:", error);
      alert("Failed to save spending controls");
    } finally {
      setSaving(false);
    }
  };

  if (!address) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500">
          Connect your wallet to manage spending controls
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-sm text-gray-600">Loading spending controls...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Spending Controls</h3>
          <p className="text-sm text-gray-600">Set limits and restrictions for your x402 payments</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Daily Limit (USDC)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            placeholder="e.g., 10.00"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty for no daily limit</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Monthly Limit (USDC)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
            placeholder="e.g., 100.00"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty for no monthly limit</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Merchant Whitelist (comma-separated)</label>
          <Input
            type="text"
            value={merchants}
            onChange={(e) => setMerchants(e.target.value)}
            placeholder="e.g., contract-generation, workflow-deployment"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty to allow all merchants</p>
        </div>

        <Button onClick={saveControls} disabled={saving} className="w-full">
          {saving ? "Saving..." : controls ? "Update Controls" : "Create Controls"}
        </Button>

        {controls && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Current limits: Daily ${controls.daily_limit || "∞"}, Monthly ${controls.monthly_limit || "∞"}
            </p>
          </div>
        )}

        {!controls && !loading && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              No spending controls configured yet. Set your limits above and click "Create Controls" to get started.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

