import { useAuth } from '../hooks/useAuth.jsx'

export default function Settings() {
  const { profile, user } = useAuth()

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
      <p className="text-slate-600 mb-8">Profile, organization, and integration settings.</p>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Email" value={user?.email} />
          <Field label="Role" value={profile?.role} />
          <Field label="First name" value={profile?.first_name} />
          <Field label="Last name" value={profile?.last_name} />
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Profile fields are shared with LexAlloc. Update them on either site.
        </p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Organization</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Organization" value={profile?.la_organizations?.name} />
          <Field label="Org ID" value={profile?.org_id} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Coming soon</h2>
        <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
          <li>Custom state-law overrides per matter</li>
          <li>Carrier-tier pricing and umbrella attachment configuration</li>
          <li>Memo template editor</li>
          <li>Cross-link matters between LexClause and LexAlloc</li>
        </ul>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">{label}</div>
      <div className="text-slate-900">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  )
}
