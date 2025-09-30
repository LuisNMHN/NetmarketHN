import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, Shield, ShieldOff } from "lucide-react"
import { DataTable, type Column } from "../_components/DataTable"
import { StatusBadge } from "../_components/StatusBadge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "../_components/ConfirmDialog"
import { UserForm } from "../_forms/UserForm"
import { getAdminUsers, type AdminUser } from "@/app/actions/admin"
import AdminUsersClient from "./AdminUsersClient"

export default async function AdminUsersPage() {
  const users = await getAdminUsers()
  
  return <AdminUsersClient initialUsers={users} />
}
