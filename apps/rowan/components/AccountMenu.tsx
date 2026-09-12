import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function AccountMenu() {
  const { user, logout } = useAuth();
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><button className="reader-account-trigger" aria-label="Open account menu"><UserRound size={21}/></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
        <DropdownMenuLabel><span className="block text-base">{user?.displayName || user?.username}</span><span className="block font-normal text-muted-foreground">@{user?.username}</span></DropdownMenuLabel>
        <DropdownMenuSeparator/>
        <DropdownMenuItem asChild><Link to="/profile"><UserRound/>Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/account"><Settings/>Settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator/>
        <DropdownMenuItem onSelect={() => {setError(""); setConfirm(true);}}><LogOut/>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
      <AlertDialogTitle>Sign out of Rowan?</AlertDialogTitle>
      <AlertDialogDescription>Your saved books and reading history will be here when you return.</AlertDialogDescription>
      {error && <p role="alert">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Stay signed in</AlertDialogCancel><button className="reader-button" disabled={busy} onClick={async () => {setBusy(true); try {await logout(); cache.clear(); setConfirm(false);} catch {setError("Could not sign out. Please try again.");} finally {setBusy(false);}}}>{busy ? "Signing out…" : "Sign out"}</button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </>;
}
