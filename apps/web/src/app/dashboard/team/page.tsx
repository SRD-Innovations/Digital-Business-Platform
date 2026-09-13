"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  STAFF_ROLES,
  apiFetch,
  type Branch,
  type Invite,
  type InviteCreated,
  type Member,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [pending, setPending] = useState(false);

  const invitableRoles = useMemo(() => {
    if (!user) return [];
    if (user.role === "owner") return [...STAFF_ROLES];
    if (user.role === "manager") return STAFF_ROLES.filter((role) => role !== "manager");
    return [];
  }, [user]);

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (stored.role !== "owner" && stored.role !== "manager") {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    Promise.all([
      apiFetch<Member[]>("/v1/team", { token: storedToken }),
      apiFetch<Invite[]>("/v1/invites", { token: storedToken }),
      apiFetch<Branch[]>("/v1/branches", { token: storedToken }),
    ])
      .then(([nextMembers, nextInvites, nextBranches]) => {
        setMembers(nextMembers);
        setInvites(nextInvites);
        setBranches(nextBranches);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load team"));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setJoinUrl("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const branchId = String(data.get("branch_id") ?? "");
    try {
      const created = await apiFetch<InviteCreated>("/v1/invites", {
        method: "POST",
        token,
        body: JSON.stringify({
          email: data.get("email"),
          role: data.get("role"),
          branch_id: branchId || null,
        }),
      });
      setInvites((current) => [created.invite, ...current]);
      setJoinUrl(`${window.location.origin}${created.join_path}`);
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create invite");
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return (
      <div className="page">
        <main className="shell">
          <p className="lede">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Team</h1>
        <p className="lede">
          Send a join link (WhatsApp or in person). No email server yet — copy the link once it appears.
        </p>
        <div className="stack">
          <div className="panel">
            <p className="panel-label">People</p>
            <ul className="row-list">
              {members.map((member) => (
                <li key={member.id}>
                  <span>
                    {member.full_name}
                    <span className="muted"> · {member.email}</span>
                  </span>
                  <span className="muted">
                    {roleLabel(member.role)}
                    {member.branch ? ` · ${member.branch.name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <p className="panel-label">Pending invites</p>
            {invites.length ? (
              <ul className="row-list">
                {invites.map((invite) => (
                  <li key={invite.id}>
                    <span>{invite.email}</span>
                    <span className="muted">{roleLabel(invite.role)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">None</p>
            )}
          </div>
          <form className="panel form" onSubmit={onSubmit}>
            <p className="panel-label">Invite staff</p>
            <label>
              Email
              <input name="email" type="email" required placeholder="cashier@business.lk" />
            </label>
            <label>
              Role
              <select name="role" required defaultValue={invitableRoles[0] ?? "cashier"}>
                {invitableRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select name="branch_id" defaultValue="">
                <option value="">Unassigned</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {joinUrl ? (
              <p>
                Join link (copy now):
                <a className="invite-link" href={joinUrl}>
                  {joinUrl}
                </a>
              </p>
            ) : null}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create invite"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
