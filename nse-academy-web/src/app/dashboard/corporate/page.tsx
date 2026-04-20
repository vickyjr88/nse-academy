"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  id: string;
  role: string;
  inviteAccepted: boolean;
  joinedAt: string;
  user: { email: string; name: string };
}

interface License {
  tier: string;
  seats: number;
  seatsUsed: number;
  status: string;
  currentPeriodEnd: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
  licenseKey: string;
  license: License | null;
  members: Member[];
}

interface Membership {
  role: string;
  org: { name: string; type: string; license: License | null };
}

export default function CorporateDashboardPage() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (!data || data.statusCode) { setLoading(false); return; }
        setMembership(data);
        if (data.role === "admin") {
          const dashRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const dashData = await dashRes.json();
          setOrg(dashData);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLink("");
    setInviteLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invite failed");
      setInviteLink(data.inviteLink);
      setInviteEmail("");
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemove(memberId: string) {
    const token = localStorage.getItem("access_token");
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/members/${memberId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setOrg((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Loading…</div>;

  if (!membership) return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">🏢</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">No corporate license</h2>
      <p className="text-gray-500 mb-6">Your account is not linked to any organization.</p>
      <Link href="/pricing" className="bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-800 transition-colors">
        View Corporate Plans →
      </Link>
    </div>
  );

  if (membership.role === "member") return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white border border-indigo-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🏢</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Premium access via {membership.org.name}</h2>
        <p className="text-sm text-gray-500 mb-4">You have full Premium access through your organization.</p>
        <div className="bg-indigo-50 rounded-xl p-4 text-left text-sm space-y-1">
          <div><span className="text-gray-500">Organization:</span> <span className="font-medium text-gray-900">{membership.org.name}</span></div>
          <div><span className="text-gray-500">Type:</span> <span className="font-medium text-gray-900 capitalize">{membership.org.type}</span></div>
          {membership.org.license && (
            <>
              <div><span className="text-gray-500">License status:</span> <span className={`font-medium ${membership.org.license.status === "active" ? "text-emerald-700" : "text-red-600"}`}>{membership.org.license.status}</span></div>
              <div><span className="text-gray-500">Renews:</span> <span className="font-medium text-gray-900">{new Date(membership.org.license.currentPeriodEnd).toLocaleDateString()}</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {org && (
        <>
          <div className="bg-white border border-indigo-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🏢</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
                <span className="text-sm text-indigo-700 font-medium capitalize bg-indigo-50 px-2 py-0.5 rounded-full">{org.type}</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              License key: <span className="font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">{org.licenseKey}</span>
            </div>
          </div>

          {org.license && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">License</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-700">{org.license.seatsUsed}/{org.license.seats}</div>
                  <div className="text-xs text-gray-500 mt-1">Seats used</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className={`text-sm font-bold mt-1 ${org.license.status === "active" ? "text-emerald-700" : "text-red-600"}`}>{org.license.status}</div>
                  <div className="text-xs text-gray-500 mt-1">Status</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-gray-900 mt-1 capitalize">{org.license.tier}</div>
                  <div className="text-xs text-gray-500 mt-1">Tier</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-gray-900 mt-1">{new Date(org.license.currentPeriodEnd).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-500 mt-1">Renews</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Invite a Member</h3>
            <form onSubmit={handleInvite} className="flex gap-3">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.co.ke"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={inviteLoading}
                className="bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors disabled:opacity-60"
              >
                {inviteLoading ? "Sending…" : "Invite"}
              </button>
            </form>
            {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
            {inviteLink && (
              <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-xs text-indigo-700 font-medium mb-1">Share this invite link:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-700 break-all flex-1">{inviteLink}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="text-xs text-indigo-700 font-semibold hover:underline shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Members ({org.members.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {org.members.map((member) => (
                    <tr key={member.id}>
                      <td className="py-3 text-gray-900">{member.user.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.inviteAccepted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {member.inviteAccepted ? "Accepted" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">{new Date(member.joinedAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        {member.role !== "admin" && (
                          <button
                            onClick={() => handleRemove(member.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
