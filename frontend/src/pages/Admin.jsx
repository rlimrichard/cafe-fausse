import { useState, useEffect, useCallback, useRef } from 'react'
import './Admin.css'

const STATUS_LABELS = { pending: 'Pending', accepted: 'Accepted', denied: 'Denied' }
const FILTERS = ['all', 'pending', 'accepted', 'denied']
const LEVEL_CLASS = { INFO: 'log-info', WARNING: 'log-warn', ERROR: 'log-error', DEBUG: 'log-debug' }

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [reservations, setReservations] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)

  const [logs, setLogs] = useState([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsPaused, setLogsPaused] = useState(false)
  const lastTsRef = useRef(null)
  const logEndRef = useRef(null)
  const pollRef = useRef(null)

  const [dbOpen, setDbOpen] = useState(false)
  const [dbTab, setDbTab] = useState('customers')
  const [dbData, setDbData] = useState({})
  const [dbLoading, setDbLoading] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchReservations = useCallback(async (pwd, f) => {
    setLoading(true)
    try {
      const qs = f !== 'all' ? `?status=${f}` : ''
      const res = await fetch(`/api/admin/reservations${qs}`, {
        headers: { 'X-Admin-Password': pwd },
      })
      if (res.status === 401) { setAuthed(false); setAuthError('Incorrect password.'); return }
      const data = await res.json()
      setReservations(Array.isArray(data) ? data : [])
    } catch {
      showToast('Failed to load reservations.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll logs every 2 s when panel is open and not paused
  const fetchLogs = useCallback(async (pwd) => {
    try {
      const qs = lastTsRef.current ? `?since=${encodeURIComponent(lastTsRef.current)}` : ''
      const res = await fetch(`/api/admin/logs${qs}`, {
        headers: { 'X-Admin-Password': pwd },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.length) {
        lastTsRef.current = data[data.length - 1].ts
        setLogs(prev => [...prev, ...data].slice(-500))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (authed) fetchReservations(password, filter)
  }, [authed, filter, fetchReservations, password])

  const fetchDbTable = useCallback(async (pwd, table) => {
    setDbLoading(true)
    try {
      const res = await fetch(`/api/admin/db/${table}`, {
        headers: { 'X-Admin-Password': pwd },
      })
      const data = await res.json()
      setDbData(prev => ({ ...prev, [table]: Array.isArray(data) ? data : [] }))
    } catch {
      showToast('Failed to load table data.', 'error')
    } finally {
      setDbLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed && dbOpen) fetchDbTable(password, dbTab)
  }, [authed, dbOpen, dbTab, fetchDbTable, password])

  useEffect(() => {
    if (!authed || !logsOpen || logsPaused) {
      clearInterval(pollRef.current)
      return
    }
    fetchLogs(password)
    pollRef.current = setInterval(() => fetchLogs(password), 2000)
    return () => clearInterval(pollRef.current)
  }, [authed, logsOpen, logsPaused, fetchLogs, password])

  // Auto-scroll to bottom when new logs arrive (unless paused)
  useEffect(() => {
    if (!logsPaused) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logsPaused])

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    setLoading(true)
    const res = await fetch('/api/admin/reservations?status=pending', {
      headers: { 'X-Admin-Password': password },
    })
    setLoading(false)
    if (res.status === 401) {
      setAuthError('Incorrect password.')
    } else {
      const data = await res.json()
      setReservations(Array.isArray(data) ? data : [])
      setAuthed(true)
    }
  }

  async function updateStatus(id, newStatus) {
    setActionLoading(id + newStatus)
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Reservation ${newStatus}.`)
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
      } else {
        showToast(data.error || 'Update failed.', 'error')
      }
    } catch {
      showToast('Network error.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteReservation(id) {
    if (!window.confirm('Delete this reservation permanently?')) return
    setActionLoading(id + 'delete')
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      })
      if (res.ok) {
        showToast('Reservation deleted.')
        setReservations(prev => prev.filter(r => r.id !== id))
      } else {
        const data = await res.json()
        showToast(data.error || 'Delete failed.', 'error')
      }
    } catch {
      showToast('Network error.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (!authed) {
    return (
      <div className="admin-login-wrap">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <h1>Restaurant Admin</h1>
          <p className="admin-login-sub">Enter your manager password to continue.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {authError && <p className="admin-login-error">{authError}</p>}
          <button type="submit" disabled={loading || !password}>
            {loading ? 'Checking…' : 'Sign In'}
          </button>
        </form>
      </div>
    )
  }

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? reservations.length : reservations.filter(r => r.status === f).length
    return acc
  }, {})

  const visible = filter === 'all' ? reservations : reservations.filter(r => r.status === filter)

  return (
    <div className="admin-page">
      {toast && <div className={`admin-toast admin-toast--${toast.type}`}>{toast.msg}</div>}

      <div className="admin-header">
        <div>
          <h1>Reservations</h1>
          <p className="admin-header-sub">Manage incoming reservation requests</p>
        </div>
        <div className="admin-header-actions">
          <button
            className={`admin-logs-toggle${dbOpen ? ' active' : ''}`}
            onClick={() => setDbOpen(o => !o)}
          >
            {dbOpen ? 'Hide DB' : 'Show DB'}
          </button>
          <button
            className={`admin-logs-toggle${logsOpen ? ' active' : ''}`}
            onClick={() => setLogsOpen(o => !o)}
          >
            {logsOpen ? 'Hide Logs' : 'Show Logs'}
          </button>
          <button className="admin-logout" onClick={() => { setAuthed(false); setPassword('') }}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="admin-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`admin-filter-btn${filter === f ? ' active' : ''} filter-${f}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="filter-count">{counts[f]}</span>
          </button>
        ))}
        <button
          className="admin-refresh"
          onClick={() => fetchReservations(password, filter)}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading reservations…</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty">No {filter === 'all' ? '' : filter} reservations.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Guest</th>
                <th>Date & Time</th>
                <th>Guests</th>
                <th>Table</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className={`row-${r.status}`}>
                  <td className="res-id">{r.id}</td>
                  <td className="res-guest">
                    <span className="guest-name">{r.name}</span>
                    <span className="guest-email">{r.email}</span>
                    {r.phone && <span className="guest-phone">{r.phone}</span>}
                  </td>
                  <td className="res-time">{formatDateTime(r.time_slot)}</td>
                  <td className="res-guests">{r.guests}</td>
                  <td className="res-table">{r.table_number}</td>
                  <td>
                    <span className={`status-badge status-${r.status}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="res-created">{formatDate(r.created_at)}</td>
                  <td className="res-actions">
                    {r.status !== 'accepted' && (
                      <button
                        className="action-btn accept-btn"
                        onClick={() => updateStatus(r.id, 'accepted')}
                        disabled={actionLoading === r.id + 'accepted'}
                      >
                        Accept
                      </button>
                    )}
                    {r.status !== 'denied' && (
                      <button
                        className="action-btn deny-btn"
                        onClick={() => updateStatus(r.id, 'denied')}
                        disabled={actionLoading === r.id + 'denied'}
                      >
                        Deny
                      </button>
                    )}
                    <button
                      className="action-btn delete-btn"
                      onClick={() => deleteReservation(r.id)}
                      disabled={actionLoading === r.id + 'delete'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DB panel ── */}
      {dbOpen && (
        <div className="db-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Database</span>
            <div className="db-tabs">
              {['customers', 'reservations'].map(t => (
                <button
                  key={t}
                  className={`db-tab${dbTab === t ? ' active' : ''}`}
                  onClick={() => setDbTab(t)}
                >
                  {t}
                  {dbData[t] && <span className="db-tab-count">{dbData[t].length}</span>}
                </button>
              ))}
            </div>
            <button
              className="log-btn"
              onClick={() => fetchDbTable(password, dbTab)}
              disabled={dbLoading}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="db-body">
            {dbLoading ? (
              <div className="db-empty">Loading…</div>
            ) : !dbData[dbTab] || dbData[dbTab].length === 0 ? (
              <div className="db-empty">No rows in <code>{dbTab}</code>.</div>
            ) : (
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      {Object.keys(dbData[dbTab][0]).map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbData[dbTab].map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j}>{val === null ? <span className="db-null">null</span> : String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Log panel ── */}
      {logsOpen && (
        <div className="log-panel">
          <div className="log-panel-header">
            <span className="log-panel-title">
              Server Logs
              <span className={`log-live-dot${logsPaused ? ' paused' : ''}`} />
            </span>
            <div className="log-panel-controls">
              <button className="log-btn" onClick={() => setLogsPaused(p => !p)}>
                {logsPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button className="log-btn" onClick={() => { setLogs([]); lastTsRef.current = null }}>
                Clear
              </button>
            </div>
          </div>
          <div className="log-body">
            {logs.length === 0
              ? <span className="log-empty">No log entries yet. Trigger an action to see output.</span>
              : logs.map((e, i) => (
                <div key={i} className={`log-entry ${LEVEL_CLASS[e.level] || 'log-info'}`}>
                  <span className="log-ts">{formatLogTs(e.ts)}</span>
                  <span className="log-level">{e.level}</span>
                  <span className="log-msg">{e.msg}</span>
                </div>
              ))
            }
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function formatLogTs(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}
