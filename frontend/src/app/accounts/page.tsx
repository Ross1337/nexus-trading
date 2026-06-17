"use client";

import { useApi } from "@/hooks/use-api";
import { api, type Account } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Wallet } from "lucide-react";

export default function AccountsPage() {
  const { data: accounts, loading } = useApi<Account[]>(api.getAccounts);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Comptes MT5</h1>
        <p className="text-muted-foreground">Gestion de vos comptes de trading</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : accounts && accounts.length > 0 ? (
        <>
          {/* Cards overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.login} | {acc.server}
                      </p>
                    </div>
                  </div>
                  <Badge variant={acc.mode === "live" ? "danger" : "success"}>
                    {acc.mode}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(acc.balance, acc.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Equity</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(acc.equity, acc.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Profit Flottant</p>
                    <p
                      className={`text-sm font-medium ${
                        acc.profit >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatCurrency(acc.profit, acc.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Marge Libre</p>
                    <p className="text-sm font-medium">
                      {formatCurrency(acc.free_margin, acc.currency)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Table détaillée */}
          <Card>
            <CardTitle className="mb-4">Tous les comptes</CardTitle>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Serveur</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Equity</TableHead>
                  <TableHead>Leverage</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">
                      {acc.name} ({acc.login})
                    </TableCell>
                    <TableCell>{acc.server}</TableCell>
                    <TableCell>
                      <Badge variant={acc.mode === "live" ? "danger" : "success"}>
                        {acc.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(acc.balance, acc.currency)}</TableCell>
                    <TableCell>{formatCurrency(acc.equity, acc.currency)}</TableCell>
                    <TableCell>1:{acc.leverage}</TableCell>
                    <TableCell>
                      <Badge variant={acc.is_active ? "success" : "muted"}>
                        {acc.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Aucun compte connecte</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Configurez vos comptes MT5 dans le fichier .env pour les voir apparaitre ici.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
