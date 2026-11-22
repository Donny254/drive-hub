import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { RefreshCw, Smartphone } from "lucide-react";
import AdminMpesaOperations from "@/components/admin/AdminMpesaOperations";

type MpesaTransaction = {
  id: string;
  phone_number: string;
  amount_cents: number;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  status: string;
  mpesa_environment: string | null;
  result_code: string | number | null;
  mpesa_receipt_number: string | null;
  response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  order_id?: string | null;
  booking_id?: string | null;
  event_registration_id?: string | null;
};

type AdminMpesaTabProps = {
  authHeaders: Record<string, string>;
};

type ApiResult = {
  error?: string;
  message?: string;
  transaction?: MpesaTransaction | null;
  transactions?: MpesaTransaction[];
  response?: Record<string, unknown>;
  count?: number;
};

const formatKes = (cents: number) =>
  `KES ${(cents / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getResponseValue = (
  response: Record<string, unknown> | null | undefined,
  keys: string[],
) => {
  if (!response) return null;

  for (const key of keys) {
    const value = response[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return null;
};

type ProviderDetails = {
  responseCode: string | null;
  description: string | null;
  stage: "callback" | "reconciliation" | "stk_push" | "unknown";
};

const getProviderDetails = (
  transaction: MpesaTransaction,
): ProviderDetails => {
  const response = transaction.response || {};

  const getObject = (key: string) => {
    const value = response[key];
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  };

  const callback = getObject("callback");
  const reconciliation = getObject("reconciliation");
  const stkPush = getObject("stk_push");

  const callbackCode = getResponseValue(callback, [
    "ResultCode",
    "resultCode",
  ]);

  const reconciliationCode = getResponseValue(reconciliation, [
    "ResultCode",
    "resultCode",
  ]);

  const stkCode = getResponseValue(stkPush, [
    "ResponseCode",
    "responseCode",
    "errorCode",
  ]);

  if (callbackCode !== null) {
    return {
      responseCode: callbackCode,
      description:
        getResponseValue(callback, ["ResultDesc", "resultDesc"]),
      stage: "callback",
    };
  }

  if (reconciliationCode !== null) {
    return {
      responseCode: reconciliationCode,
      description:
        getResponseValue(reconciliation, [
          "ResultDesc",
          "resultDesc",
          "ResponseDescription",
        ]),
      stage: "reconciliation",
    };
  }

  if (stkCode !== null) {
    return {
      responseCode: stkCode,
      description:
        getResponseValue(stkPush, [
          "ResponseDescription",
          "responseDescription",
          "CustomerMessage",
          "errorMessage",
        ]),
      stage: "stk_push",
    };
  }

  return {
    responseCode:
      transaction.result_code != null
        ? String(transaction.result_code)
        : null,
    description: null,
    stage: "unknown",
  };
};

const getSafaricomExplanation = (
  code: string | null,
  stage: ProviderDetails["stage"],
  providerDescription: string | null,
) => {
  if (code === "2029") {
    return {
      title: "Unresolved payment outcome",
      explanation:
        "Safaricom returned an unresolved reason. The query was accepted, but this response does not confirm whether the customer paid.",
      action:
        "Keep the transaction pending. Check again later and wait for the STK callback. Do not manually mark it paid.",
      severity: "warning" as const,
    };
  }

  if (code === "1032") {
    return {
      title: "Customer cancelled",
      explanation: "The customer cancelled the STK request.",
      action: "Confirm with the customer before initiating another payment prompt.",
      severity: "destructive" as const,
    };
  }

  if (code === "1037") {
    return {
      title: "Customer unreachable or request timed out",
      explanation: "Safaricom reported a timeout while attempting to complete the STK request.",
      action: "Check the transaction again before retrying. Avoid sending repeated prompts immediately.",
      severity: "warning" as const,
    };
  }

  if (code === "0" && stage === "stk_push") {
    return {
      title: "STK request accepted",
      explanation: "Safaricom accepted the STK Push request. This is not proof of payment.",
      action: "Wait for the callback or query the Checkout Request ID for the final result.",
      severity: "success" as const,
    };
  }

  if (code === "0" && stage === "callback") {
    return {
      title: "Payment successful",
      explanation: "The STK callback reports a successful payment.",
      action: "Verify the receipt number and transaction amount in the transaction details.",
      severity: "success" as const,
    };
  }

  if (code === "0" && stage === "reconciliation") {
    return {
      title: "Safaricom query reports success",
      explanation: "The reconciliation response reports result code 0.",
      action: "Check that the transaction was settled and that the receipt and amount are recorded.",
      severity: "success" as const,
    };
  }

  if (code === null) {
    return {
      title: "No provider result code",
      explanation:
        providerDescription ||
        "No Safaricom result code has been recorded for this transaction.",
      action:
        "Inspect the stored provider response and try a status query if the transaction is pending.",
      severity: "secondary" as const,
    };
  }

  return {
    title: `Provider result ${code}`,
    explanation:
      providerDescription ||
      "No verified explanation is available in the local response dictionary.",
    action:
      "Use the provider's ResultDesc and raw response for diagnosis. Do not assume an unknown result code means payment success.",
    severity: "secondary" as const,
  };
};

const getStatusVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "paid") return "default";
  if (status === "failed") return "destructive";
  if (status === "pending") return "secondary";
  return "outline";
};

const AdminMpesaTab = ({ authHeaders }: AdminMpesaTabProps) => {
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queryingTransactionId, setQueryingTransactionId] = useState<string | null>(
    null,
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const transactionsPageSize = 10;
  const [selectedTransaction, setSelectedTransaction] =
    useState<MpesaTransaction | null>(null);

  const loadTransactions = useCallback(async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiFetch(
        "/api/payments/mpesa/admin/transactions?limit=200",
        { headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        throw new Error(data.error || data.message || "Could not load M-Pesa transactions.");
      }

      const loadedTransactions = Array.isArray(data.transactions)
        ? data.transactions
        : [];

      setTransactions(loadedTransactions);

      setSelectedTransaction((current) => {
        if (!current) return null;

        return (
          loadedTransactions.find((item) => item.id === current.id) || current
        );
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load M-Pesa transactions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesStatus =
        statusFilter === "all" || transaction.status === statusFilter;

      const matchesSearch =
        !term ||
        [
          transaction.phone_number,
          transaction.checkout_request_id,
          transaction.merchant_request_id,
          transaction.mpesa_receipt_number,
          transaction.id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [transactions, search, statusFilter]);

  const transactionsPageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / transactionsPageSize),
  );

  const paginatedTransactions = filteredTransactions.slice(
    (transactionsPage - 1) * transactionsPageSize,
    transactionsPage * transactionsPageSize,
  );

  useEffect(() => {
    setTransactionsPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setTransactionsPage((page) => Math.min(page, transactionsPageCount));
  }, [transactionsPageCount]);

  const summary = useMemo(
    () => ({
      total: transactions.length,
      pending: transactions.filter((item) => item.status === "pending").length,
      paid: transactions.filter((item) => item.status === "paid").length,
      failed: transactions.filter((item) => item.status === "failed").length,
    }),
    [transactions],
  );

  const initiateStkPush = async () => {
    const normalizedPhone = phoneNumber.trim();
    const numericAmount = Number(amount);

    if (!normalizedPhone || !/^(\+?254|0)?[17]\d{8}$/.test(normalizedPhone.replace(/\s+/g, ""))) {
      toast.error("Enter a valid Kenyan mobile number.");
      return;
    }

    if (!Number.isSafeInteger(numericAmount) || numericAmount < 1) {
      toast.error("Enter a valid whole amount in KES.");
      return;
    }

    const confirmed = window.confirm(
      `Send a real M-Pesa STK Push for KES ${numericAmount.toLocaleString()} to ${normalizedPhone}?\n\nThe phone owner will receive a payment prompt. Only proceed with their knowledge and authorization.`,
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await apiFetch("/api/payments/mpesa/admin/stk-push", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
          amount: numericAmount,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResult;

      if (data.transaction) {
        setSelectedTransaction(data.transaction);
      }

      await loadTransactions(true);

      if (!response.ok) {
        throw new Error(
          data.error ||
            getResponseValue(data.response, [
              "ResponseDescription",
              "errorMessage",
              "errorCode",
            ]) ||
            "Safaricom did not accept the STK Push request.",
        );
      }

      toast.success("STK Push request submitted. Payment is awaiting customer action.");
      setPhoneNumber("");
      setAmount("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "STK Push request failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const queryStkStatus = async (transaction: MpesaTransaction) => {
    if (!transaction.checkout_request_id) {
      toast.error("This transaction has no Checkout Request ID.");
      return;
    }

    if (transaction.status !== "pending") {
      toast.info(`This transaction is already ${transaction.status}.`);
      return;
    }

    setQueryingTransactionId(transaction.id);

    try {
      const response = await apiFetch(
        `/api/payments/mpesa/admin/transactions/${encodeURIComponent(transaction.id)}/query`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );

      const data = (await response.json().catch(() => ({}))) as ApiResult & {
        status?: string;
        resultCode?: string | number | null;
        queried?: boolean;
      };

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Could not query Safaricom for this transaction.",
        );
      }

      if (data.transaction) {
        setSelectedTransaction(data.transaction);
      }

      await loadTransactions(true);

      if (data.status === "paid") {
        toast.success("Safaricom confirmed the payment as paid.");
      } else if (data.status === "failed") {
        toast.error("Safaricom confirmed that the payment failed.");
      } else {
        toast.info(
          data.message ||
            "No final result yet. The transaction remains pending.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "STK Query failed.",
      );
    } finally {
      setQueryingTransactionId(null);
    }
  };

  return (
    <TabsContent value="mpesa" className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total transactions", value: summary.total },
          { label: "Pending", value: summary.pending },
          { label: "Paid", value: summary.paid },
          { label: "Failed", value: summary.failed },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {item.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="transactions" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="stk">STK Push</TabsTrigger>
          <TabsTrigger value="callbacks">Callbacks & Pull</TabsTrigger>
        </TabsList>

        <TabsContent value="stk" className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5" />
                Initiate STK Push
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a payment prompt and save the attempt in M-Pesa transaction history.
              </p>
            </div>
            <Badge variant="outline">Admin action</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mpesa-admin-phone">Customer phone number</Label>
              <Input
                id="mpesa-admin-phone"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="0712345678 or 254712345678"
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mpesa-admin-amount">Amount (KES)</Label>
              <Input
                id="mpesa-admin-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void initiateStkPush()} disabled={submitting}>
              {submitting ? "Sending request..." : "Send STK Push"}
            </Button>
            <p className="text-xs text-muted-foreground">
              This sends a real payment prompt. Confirm the phone number and amount first.
            </p>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="transactions" className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">M-Pesa Transactions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Inspect STK requests, Safaricom responses and callback results.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadTransactions(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <div className="grid gap-2">
              <Label htmlFor="mpesa-search">Search transactions</Label>
              <Input
                id="mpesa-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Phone, transaction ID, receipt or Checkout ID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mpesa-status-filter">Status</Label>
              <select
                id="mpesa-status-filter"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone / Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Safaricom response</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedTransactions.map((transaction) => {
                  const provider = getProviderDetails(transaction);

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <p className="font-medium">{transaction.phone_number}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(transaction.created_at)}
                        </p>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {formatKes(transaction.amount_cents)}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {transaction.mpesa_environment || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <p className="font-mono text-xs">
                          {provider.responseCode || "--"}
                        </p>
                        <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                          {provider.description || "No provider description recorded"}
                        </p>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={getStatusVariant(transaction.status)}
                          className="capitalize"
                        >
                          {transaction.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {transaction.status === "pending" &&
                            transaction.checkout_request_id && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={queryingTransactionId !== null}
                                onClick={() => void queryStkStatus(transaction)}
                              >
                                <RefreshCw
                                  className={`mr-2 h-3.5 w-3.5 ${
                                    queryingTransactionId === transaction.id
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                {queryingTransactionId === transaction.id
                                  ? "Querying..."
                                  : "Query Status"}
                              </Button>
                            )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTransaction(transaction)}
                          >
                            Inspect
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No M-Pesa transactions match these filters.
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Loading M-Pesa transactions...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              {filteredTransactions.length === 0
                ? 0
                : (transactionsPage - 1) * transactionsPageSize + 1}
              {" – "}
              {Math.min(
                transactionsPage * transactionsPageSize,
                filteredTransactions.length,
              )}{" "}
              of {filteredTransactions.length}
            </p>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={transactionsPage <= 1}
                onClick={() => setTransactionsPage((page) => page - 1)}
              >
                Previous
              </Button>

              <span className="text-sm tabular-nums">
                {transactionsPage} / {transactionsPageCount}
              </span>

              <Button
                size="sm"
                variant="outline"
                disabled={transactionsPage >= transactionsPageCount}
                onClick={() => setTransactionsPage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTransaction && (
        <Card className="rounded-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Transaction diagnostics</CardTitle>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {selectedTransaction.id}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            {selectedTransaction.status === "pending" &&
              selectedTransaction.checkout_request_id && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">Check payment with Safaricom</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Query the Checkout Request ID to check whether the customer completed
                      or cancelled the payment.
                    </p>
                  </div>

                  <Button
                    onClick={() => void queryStkStatus(selectedTransaction)}
                    disabled={queryingTransactionId !== null}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${
                        queryingTransactionId === selectedTransaction.id
                          ? "animate-spin"
                          : ""
                      }`}
                    />
                    {queryingTransactionId === selectedTransaction.id
                      ? "Querying Safaricom..."
                      : "Query STK Status"}
                  </Button>
                </div>
              )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="mt-1 font-medium">{selectedTransaction.phone_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="mt-1 font-medium">
                  {formatKes(selectedTransaction.amount_cents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  className="mt-1 capitalize"
                  variant={getStatusVariant(selectedTransaction.status)}
                >
                  {selectedTransaction.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Checkout Request ID</p>
                <p className="mt-1 break-all font-mono text-xs">
                  {selectedTransaction.checkout_request_id || "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Merchant Request ID</p>
                <p className="mt-1 break-all font-mono text-xs">
                  {selectedTransaction.merchant_request_id || "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">M-Pesa receipt</p>
                <p className="mt-1 font-mono text-xs">
                  {selectedTransaction.mpesa_receipt_number || "--"}
                </p>
              </div>
            </div>

            {(() => {
              const provider = getProviderDetails(selectedTransaction);
              const explanation = getSafaricomExplanation(
                provider.responseCode,
                provider.stage,
                provider.description,
              );

              return (
                <Card className="border-border shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        Safaricom response diagnosis
                      </CardTitle>
                      <Badge variant="outline" className="capitalize">
                        {provider.stage.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-2xl font-semibold">
                        {provider.responseCode || "--"}
                      </span>
                      <Badge
                        variant={
                          explanation.severity === "destructive"
                            ? "destructive"
                            : explanation.severity === "success"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {explanation.title}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {explanation.explanation}
                    </p>

                    {provider.description && (
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs font-medium">Safaricom description</p>
                        <p className="mt-1 text-sm">{provider.description}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium">Recommended action</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {explanation.action}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <div>
              <p className="mb-2 text-sm font-medium">Stored Safaricom response</p>
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">
                {JSON.stringify(selectedTransaction.response || {}, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="callbacks" className="space-y-5">
          <AdminMpesaOperations authHeaders={authHeaders} />
        </TabsContent>
      </Tabs>
    </TabsContent>
  );
};

export default AdminMpesaTab;
