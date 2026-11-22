import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { RefreshCw, Download, Webhook, Link2 } from "lucide-react";

type Props = {
  authHeaders: Record<string, string>;
};

type C2BTransaction = {
  id: string;
  transId: string;
  transactionType: string | null;
  transTime: string | null;
  amountCents: number | null;
  businessShortCode: string | null;
  billRefNumber: string | null;
  msisdn: string | null;
  orgAccountBalance: string | null;
  source: string;
  createdAt: string;
};

type PullResult = {
  responseCode?: string;
  responseMessage?: string | null;
  fetched?: number;
  newTransactions?: number;
  transactions?: unknown[];
};

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatKes = (cents: number | null) =>
  cents == null
    ? "--"
    : `KES ${(cents / 100).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const AdminMpesaOperations = ({ authHeaders }: Props) => {
  const today = localDate(new Date());

  const [transactions, setTransactions] = useState<C2BTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registeringC2B, setRegisteringC2B] = useState(false);
  const [registeringPull, setRegisteringPull] = useState(false);
  const [queryingPull, setQueryingPull] = useState(false);

  const [nominatedNumber, setNominatedNumber] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [offsetValue, setOffsetValue] = useState("0");

  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [lastProviderResponse, setLastProviderResponse] =
    useState<Record<string, unknown> | null>(null);

  const loadC2BTransactions = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await apiFetch(
        "/api/payments/mpesa/c2b-transactions?limit=200",
        { headers: authHeaders },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Could not load C2B transactions.",
        );
      }

      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load C2B transactions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadC2BTransactions();
  }, [loadC2BTransactions]);

  const registerC2BUrls = async () => {
    setRegisteringC2B(true);
    setLastProviderResponse(null);

    try {
      const response = await apiFetch("/api/payments/mpesa/register-url", {
        method: "POST",
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));

      setLastProviderResponse(data.response || data);

      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.error ||
            data.response?.ResponseDescription ||
            "C2B URL registration failed.",
        );
      }

      toast.success("C2B validation and confirmation URLs registered.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "C2B registration failed.",
      );
    } finally {
      setRegisteringC2B(false);
    }
  };

  const registerPull = async () => {
    const phone = nominatedNumber.trim();

    if (!/^(\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
      toast.error("Enter a valid Kenyan nominated mobile number.");
      return;
    }

    setRegisteringPull(true);
    setLastProviderResponse(null);

    try {
      const response = await apiFetch("/api/payments/mpesa/pull/register", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ nominatedNumber: phone }),
      });

      const data = await response.json().catch(() => ({}));
      setLastProviderResponse(data.response || data);

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.response?.ResponseDescription ||
            "Pull registration failed.",
        );
      }

      toast.success(
        "Pull registration request submitted. Check the provider response below.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pull registration failed.",
      );
    } finally {
      setRegisteringPull(false);
    }
  };

  const queryPullTransactions = async () => {
    if (!startDate || !endDate) {
      toast.error("Select both the start and end dates.");
      return;
    }

    if (endDate < startDate) {
      toast.error("End date cannot be earlier than start date.");
      return;
    }

    const offset = Number(offsetValue);

    if (!Number.isSafeInteger(offset) || offset < 0) {
      toast.error("Offset must be a non-negative whole number.");
      return;
    }

    setQueryingPull(true);
    setPullResult(null);
    setLastProviderResponse(null);

    try {
      const response = await apiFetch("/api/payments/mpesa/pull/query", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          startDate,
          endDate,
          offsetValue: String(offset),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as PullResult & {
        error?: string;
        message?: string;
      };

      setPullResult(data);
      setLastProviderResponse(data);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Pull Transactions query failed.",
        );
      }

      if (String(data.responseCode) === "1000") {
        toast.success(
          `Pull query completed. ${data.newTransactions || 0} new transactions saved.`,
        );
      } else if (String(data.responseCode) === "1001") {
        toast.info("Safaricom returned no matching transactions.");
      } else {
        toast.warning(
          data.responseMessage ||
            `Pull query returned provider code ${data.responseCode || "unknown"}.`,
        );
      }

      await loadC2BTransactions(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pull query failed.",
      );
    } finally {
      setQueryingPull(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">C2B and Pull Transactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register payment callbacks, retrieve Paybill/Till records and
          reconcile transactions received from Safaricom.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Webhook className="h-5 w-5" />
              C2B Callback Registration
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            <p className="text-sm text-muted-foreground">
              Register the C2B validation and confirmation callback URLs with
              Safaricom for the configured shortcode.
            </p>

            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="font-medium">Confirmation endpoint</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                /api/payments/c2b/confirmation
              </p>
              <p className="mt-3 font-medium">Validation endpoint</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                /api/payments/c2b/validation
              </p>
            </div>

            <Button
              onClick={() => void registerC2BUrls()}
              disabled={registeringC2B}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {registeringC2B ? "Registering..." : "Register C2B URLs"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5" />
              Pull Transactions Registration
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            <p className="text-sm text-muted-foreground">
              Register the nominated number that Safaricom requires for Pull
              Transactions access.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="mpesa-nominated-number">
                Nominated mobile number
              </Label>
              <Input
                id="mpesa-nominated-number"
                value={nominatedNumber}
                onChange={(event) => setNominatedNumber(event.target.value)}
                placeholder="0712345678"
                autoComplete="tel"
              />
            </div>

            <Button
              onClick={() => void registerPull()}
              disabled={registeringPull}
            >
              {registeringPull ? "Submitting..." : "Register Pull Access"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg">Pull Transactions Query</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request C2B transaction records for a date range. Pull availability
            and date restrictions are controlled by Safaricom.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="mpesa-pull-start">Start date</Label>
              <Input
                id="mpesa-pull-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                max={today}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mpesa-pull-end">End date</Label>
              <Input
                id="mpesa-pull-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                min={startDate}
                max={today}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mpesa-pull-offset">Offset value</Label>
              <Input
                id="mpesa-pull-offset"
                type="number"
                min="0"
                step="1"
                value={offsetValue}
                onChange={(event) => setOffsetValue(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => void queryPullTransactions()}
                disabled={queryingPull}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    queryingPull ? "animate-spin" : ""
                  }`}
                />
                {queryingPull ? "Querying..." : "Fetch Transactions"}
              </Button>
            </div>
          </div>

          {pullResult && (
            <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Provider code</p>
                <p className="mt-1 font-mono font-semibold">
                  {pullResult.responseCode || "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Records fetched</p>
                <p className="mt-1 text-lg font-semibold">
                  {pullResult.fetched ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New records saved</p>
                <p className="mt-1 text-lg font-semibold">
                  {pullResult.newTransactions ?? 0}
                </p>
              </div>
              {pullResult.responseMessage && (
                <p className="text-sm text-muted-foreground sm:col-span-3">
                  {pullResult.responseMessage}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lastProviderResponse && (
        <Card className="rounded-2xl">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">
              Latest Safaricom operation response
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-xs">
              {JSON.stringify(lastProviderResponse, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">C2B Transaction History</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Transactions received through C2B confirmation callbacks or
                retrieved through Pull Transactions.
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadC2BTransactions(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline">
              {transactions.length} loaded records
            </Badge>
            <Badge variant="secondary">
              {transactions.filter((item) => item.source === "c2b").length} callback
              records
            </Badge>
            <Badge variant="secondary">
              {transactions.filter((item) => item.source === "pull").length} pull
              records
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt / Date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Account reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-medium">
                        {transaction.transId}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(transaction.transTime || transaction.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {transaction.msisdn || "--"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatKes(transaction.amountCents)}
                    </TableCell>
                    <TableCell>
                      {transaction.billRefNumber || "--"}
                    </TableCell>
                    <TableCell>
                      {transaction.transactionType || "--"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="capitalize"
                      >
                        {transaction.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && transactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No C2B transactions have been recorded yet.
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Loading C2B transactions...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMpesaOperations;
