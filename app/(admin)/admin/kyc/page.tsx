import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { KycDetailDrawer } from "../_components/KycDetailDrawer"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { getKycRequests, type KycRequest } from "@/app/actions/admin"
import AdminKycClient from "./AdminKycClient"

export default async function AdminKycPage() {
  const requests = await getKycRequests()
  
  return <AdminKycClient initialRequests={requests} />
}
