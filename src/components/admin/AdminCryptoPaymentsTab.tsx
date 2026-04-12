import { useMemo, useState } from "react";
import type { CryptoTransaction } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { resolveImageUrl } from "@/lib/api";
import { getCryptoExplorerUrl } from "@/lib/crypto";
import { toast } from "@/components/ui/sonner";

type AdminCryptoPaymentsTabProps = {
  cryptoTransactions: CryptoTransaction[];
  openCryptoReview: (transaction: CryptoTransaction) => void;
  formatMoney: (cents?: number | null) => string;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
};

const AdminCryptoPaymentsTab = ({
  cryptoTransactions,
  openCryptoReview,
  formatMoney,
  statusVariant,
}: AdminCryptoPaymentsTabProps) => {
  const [statusFilter, setStatusFilter] = useState<CryptoTransaction["status"] | "all">("all");
  const [search, setSearch] = useState("");

  const filteredTransactions = useMemo(() => {
    return cryptoTransactions.filter((transaction) => {
      const matchesStatus = statusFilter === "all" ? true : transaction.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query
        ? true
        : [
            transaction.reference,
            transaction.label,
            transaction.transactionHash,
            transaction.payerWallet,
            transaction.asset,
            transaction.network,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [cryptoTransactions, search, statusFilter]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <TabsContent value="crypto-payments" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Crypto Payments</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Review pending proofs, inspect history, and copy submitted wallet details without leaving admin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {cryptoTransactions.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {cryptoTransactions.filter((item) => item.status === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {cryptoTransactions.filter((item) => item.status === "paid").length} approved
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {cryptoTransactions.filter((item) => item.status === "failed").length} rejected
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="grid gap-2">
              <Label>Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by reference, label, hash, wallet, or network"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CryptoTransaction["status"] | "all")}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium capitalize">
                          {transaction.relationType.replaceAll("_", " ")} {transaction.reference}
                        </p>
                        {transaction.label ? (
                          <p className="mt-1 text-xs text-muted-foreground">{transaction.label}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                          {transaction.asset}
                          {transaction.network ? ` • ${transaction.network}` : ""}
                        </p>
                        {transaction.proofImageUrl ? (
                          <a
                            href={resolveImageUrl(transaction.proofImageUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-primary hover:underline"
                          >
                            View proof
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatMoney(transaction.amountCents)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="max-w-[220px] truncate font-mono text-xs">{transaction.transactionHash}</p>
                        {transaction.payerWallet ? (
                          <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {transaction.payerWallet}
                          </p>
                        ) : null}
                        {getCryptoExplorerUrl(transaction.network, transaction.transactionHash) ? (
                          <a
                            href={getCryptoExplorerUrl(transaction.network, transaction.transactionHash) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-xs text-primary hover:underline"
                          >
                            Open explorer
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(transaction.status)} className="capitalize">
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {transaction.reviewNotes || "--"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void copyText(transaction.transactionHash, "Transaction hash")}>
                          Copy Hash
                        </Button>
                        {transaction.walletAddress ? (
                          <Button variant="ghost" size="sm" onClick={() => void copyText(transaction.walletAddress!, "Wallet address")}>
                            Copy Wallet
                          </Button>
                        ) : null}
                        {transaction.proofImageUrl ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={resolveImageUrl(transaction.proofImageUrl)} target="_blank" rel="noreferrer">
                              View Proof
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => openCryptoReview(transaction)}>
                          Review
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No crypto payments match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminCryptoPaymentsTab;
