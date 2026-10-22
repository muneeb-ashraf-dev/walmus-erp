'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Database, ShieldCheck, HardDrive, Clock, Terminal, 
  Copy, Check, AlertTriangle, CheckSquare, Square,
  Download, RefreshCw, FileText, ExternalLink, HelpCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

export default function BackupPage() {
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  // Restore verification checklist state
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
  });

  const toggleStep = (stepKey: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(label);
    toast.success(`Copied: ${label}`);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Backup & Disaster Recovery</h1>
            <p className="text-sm text-muted-foreground">
              Long-term backup target is Supabase. The in-app Supabase backup workflow is deferred; local pg_dump scripts remain available as an interim fallback.
            </p>
          </div>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 px-3 py-1 self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 mr-1.5 inline" /> Supabase Backup: Planned / Deferred
          </Badge>
        </div>

        {/* Status & Retention KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Production Backup
              </CardTitle>
              <Database className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">Manual Supabase</div>
              <p className="text-xs text-muted-foreground mt-1">Dashboard export or pg_dump — implementation deferred</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Retention Policy
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">Owner-defined</div>
              <p className="text-xs text-muted-foreground mt-1">Daily/weekly/monthly copies kept outside Supabase</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Interim Local Directory
              </CardTitle>
              <HardDrive className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono font-bold truncate">D:\pharma-erp-backups</div>
              <p className="text-xs text-muted-foreground mt-1">Used only while running a local PostgreSQL instance</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Business Data Export
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-violet-600">Available</div>
              <p className="text-xs text-muted-foreground mt-1">XLSX/CSV export from Reports and Import &amp; Export</p>
            </CardContent>
          </Card>
        </div>

        {/* Execution & Script Runner Commands */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Interim Local Backup Runner
            </CardTitle>
            <CardDescription>
              These commands apply only to a local PostgreSQL instance. For the Supabase production database, use the Supabase Dashboard backup flow or <code className="text-xs">pg_dump</code> against the Supabase connection string. See <code className="text-xs">docs/backup-and-restore.md</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Standard Compressed Backup Command:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => copyToClipboard('cd D:\\WALMUS_ERP; .\\scripts\\backup.ps1', 'Standard Backup')}
                >
                  {copiedScript === 'Standard Backup' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  Copy Command
                </Button>
              </div>
              <pre className="p-3 bg-muted rounded-lg font-mono text-xs overflow-x-auto text-primary">
                cd D:\WALMUS_ERP; .\scripts\backup.ps1
              </pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 border rounded-lg space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Custom Directory Destination:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => copyToClipboard('.\\scripts\\backup.ps1 -BackupDir "E:\\ExternalBackups"', 'Custom Dir')}
                  >
                    Copy
                  </Button>
                </div>
                <code className="text-[11px] font-mono text-muted-foreground block truncate">
                  .\scripts\backup.ps1 -BackupDir &quot;E:\ExternalBackups&quot;
                </code>
              </div>

              <div className="p-3 border rounded-lg space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">AES-256 Encrypted Backup (GPG):</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => copyToClipboard('.\\scripts\\backup.ps1 -Encrypt', 'Encrypted Backup')}
                  >
                    Copy
                  </Button>
                </div>
                <code className="text-[11px] font-mono text-muted-foreground block truncate">
                  .\scripts\backup.ps1 -Encrypt
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PRD Module 12 Verification & Disaster Recovery Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step-by-Step Restoration Procedure */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Disaster Recovery & Restore Procedure
              </CardTitle>
              <CardDescription>
                Local PostgreSQL restore sequence. For Supabase, restore into a separate test project first, then schedule a production maintenance window.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <p className="font-semibold text-foreground">Stop Application & Prevent Inbound Traffic</p>
                  <p className="text-muted-foreground mt-0.5">
                    Halt backend FastAPI and background tasks so no active connections hold locks on tables.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <p className="font-semibold text-foreground">Safety Pre-Restore Snapshot</p>
                  <p className="text-muted-foreground mt-0.5">
                    Always dump the current state before overwriting:
                  </p>
                  <code className="block mt-1 p-2 bg-muted rounded font-mono text-[11px] text-primary">
                    pg_dump -h localhost -U pharma_user -d pharma_erp -Fc -f &quot;pre_restore.dump&quot;
                  </code>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <p className="font-semibold text-foreground">Execute pg_restore</p>
                  <p className="text-muted-foreground mt-0.5">
                    Restore custom archive format with verbose integrity checks:
                  </p>
                  <code className="block mt-1 p-2 bg-muted rounded font-mono text-[11px] text-primary">
                    pg_restore -h localhost -U pharma_user -d pharma_erp -v &quot;pharma_erp_backup.dump&quot;
                  </code>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                  4
                </div>
                <div>
                  <p className="font-semibold text-foreground">Run Alembic Schema Verification</p>
                  <p className="text-muted-foreground mt-0.5">
                    Ensure database revisions match the codebase:
                  </p>
                  <code className="block mt-1 p-2 bg-muted rounded font-mono text-[11px] text-primary">
                    cd backend; uv run alembic upgrade head
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Pre-Flight Verification Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-600" />
                Restore Verification Checklist
              </CardTitle>
              <CardDescription>
                PRD Module 12 required smoke tests before declaring restoration complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div 
                onClick={() => toggleStep('step1')}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5">
                  {checkedSteps.step1 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Archive Header Integrity Passed</p>
                  <p className="text-muted-foreground">Executed pg_restore --list without CRC or decompression errors.</p>
                </div>
              </div>

              <div 
                onClick={() => toggleStep('step2')}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5">
                  {checkedSteps.step2 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Master Data Verification</p>
                  <p className="text-muted-foreground">Medicine catalog, customer profiles, and supplier accounts verified intact.</p>
                </div>
              </div>

              <div 
                onClick={() => toggleStep('step3')}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5">
                  {checkedSteps.step3 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Journal & Ledger Balance Zero Test</p>
                  <p className="text-muted-foreground">Verified all posted journal vouchers satisfy Total Debits == Total Credits.</p>
                </div>
              </div>

              <div 
                onClick={() => toggleStep('step4')}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5">
                  {checkedSteps.step4 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Inventory Batch Quantities Smoke Test</p>
                  <p className="text-muted-foreground">Available stock batch counts reconcile with inventory summary view.</p>
                </div>
              </div>

              <div 
                onClick={() => toggleStep('step5')}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5">
                  {checkedSteps.step5 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Application Opens Without Login</p>
                  <p className="text-muted-foreground">Confirmed the restored build opens directly on the dashboard and loads settings, inventory, and imported history.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
