import { useState, useEffect, useCallback, useRef } from 'react'
import './Admin.css'

const STATUS_LABELS = { pending: 'Pending', accepted: 'Accepted', denied: 'Denied' }
const FILTERS = ['all', 'pending', 'accepted', 'denied']
const LEVEL_CLASS = { INFO: 'log-info', WARNING: 'log-warn', ERROR: 'log-error', DEBUG: 'log-debug' }
const EMPTY_MENU_ITEM = { category: 'Starters', name: '', description: '', price: '', image_url: '', display_order: 0 }
const MENU_CATEGORIES = ['Starters', 'Main Courses', 'Desserts', 'Beverages']

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [reservations, setReservations] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [activeView, setActiveView] = useState('reservations')

  const [logs, setLogs] = useState([])
  const [logsPaused, setLogsPaused] = useState(false)
  const lastTsRef = useRef(null)
  const logEndRef = useRef(null)
  const pollRef = useRef(null)

  const [dbTab, setDbTab] = useState('customers')
  const [dbData, setDbData] = useState({})
  const [dbCounts, setDbCounts] = useState({})
  const [dbLoading, setDbLoading] = useState(false)
  const [insights, setInsights] = useState(null)
  const menuOpen = activeView === 'menu'
  const subscribersOpen = activeView === 'subscribers'
  const calendarOpen = activeView === 'calendar'
  const dbOpen = activeView === 'database'
  const logsOpen = activeView === 'logs'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchReservations = useCallback(async (pwd) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const res = await fetch('/api/admin/reservations', {
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
    if (authed) fetchReservations(password)
  }, [authed, fetchReservations, password])

  const fetchDbTable = useCallback(async (pwd, table) => {
    setDbLoading(true)
    try {
      const res = await fetch(`/api/admin/db/${table}`, {
        headers: { 'X-Admin-Password': pwd },
      })
      const data = await res.json()
      const rows = Array.isArray(data) ? data : []
      setDbData(prev => ({ ...prev, [table]: rows }))
      if (res.ok) setDbCounts(prev => ({ ...prev, [table]: rows.length }))
    } catch {
      showToast('Failed to load table data.', 'error')
    } finally {
      setDbLoading(false)
    }
  }, [])

  const fetchDbCounts = useCallback(async (pwd) => {
    try {
      const res = await fetch('/api/admin/db-counts', {
        headers: { 'X-Admin-Password': pwd },
      })
      const data = await res.json()
      if (res.ok) setDbCounts(data)
    } catch {
      showToast('Failed to load database counts.', 'error')
    }
  }, [])

  useEffect(() => {
    if (authed) fetchDbCounts(password)
  }, [authed, fetchDbCounts, password])

  const fetchInsights = useCallback(async (pwd) => {
    try {
      const res = await fetch('/api/admin/insights', {
        headers: { 'X-Admin-Password': pwd },
      })
      const data = await res.json()
      if (res.ok) setInsights(data)
    } catch {
      showToast('Failed to load visitor insights.', 'error')
    }
  }, [])

  useEffect(() => {
    if (authed) fetchInsights(password)
  }, [authed, fetchInsights, password])

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

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(ids) {
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids))
  }

  async function handleBulkAction(action) {
    const ids = [...selected]
    if (action === 'delete' && !window.confirm(`Delete ${ids.length} reservation(s) permanently?`)) return
    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/reservations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message)
        if (action === 'delete') {
          setReservations(prev => prev.filter(r => !selected.has(r.id)))
        } else {
          setReservations(prev => prev.map(r => selected.has(r.id) ? { ...r, status: action } : r))
        }
        setSelected(new Set())
      } else {
        showToast(data.error || 'Bulk action failed.', 'error')
      }
    } catch {
      showToast('Network error.', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    setLoading(true)
    const res = await fetch('/api/admin/reservations', {
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
          <h1>Restaurant Admin</h1>
          <p className="admin-header-sub">Manage reservations, menu content, database records, and server activity</p>
        </div>
        <div className="admin-header-actions">
          <button
            className={`admin-logs-toggle${activeView === 'reservations' ? ' active' : ''}`}
            onClick={() => setActiveView('reservations')}
          >
            Reservations
          </button>
          <button
            className={`admin-logs-toggle${menuOpen ? ' active' : ''}`}
            onClick={() => setActiveView('menu')}
          >
            Menu
          </button>
          <button
            className={`admin-logs-toggle${subscribersOpen ? ' active' : ''}`}
            onClick={() => setActiveView('subscribers')}
          >
            Subscribers
          </button>
          <button
            className={`admin-logs-toggle${calendarOpen ? ' active' : ''}`}
            onClick={() => setActiveView('calendar')}
          >
            Calendar
          </button>
          <button
            className={`admin-logs-toggle${dbOpen ? ' active' : ''}`}
            onClick={() => setActiveView('database')}
          >
            Database
          </button>
          <button
            className={`admin-logs-toggle${logsOpen ? ' active' : ''}`}
            onClick={() => setActiveView('logs')}
          >
            Logs
          </button>
          <button className="admin-logout" onClick={() => { setAuthed(false); setPassword('') }}>
            Sign Out
          </button>
        </div>
      </div>

      <section className="admin-insights" aria-label="Visitor insights">
        <div className="insight-card">
          <span>Unique visitors</span>
          <strong>{insights ? insights.unique_visitors : '—'}</strong>
          <small>All time</small>
        </div>
        <div className="insight-card">
          <span>Visitors today</span>
          <strong>{insights ? insights.visitors_today : '—'}</strong>
          <small>Unique anonymous visitors</small>
        </div>
        <div className="insight-card">
          <span>Page visits</span>
          <strong>{insights ? insights.visit_events : '—'}</strong>
          <small>All recorded page views</small>
        </div>
      </section>

      {activeView === 'reservations' && <>
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
          onClick={() => fetchReservations(password)}
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
          {selected.size > 0 && (
            <div className="bulk-toolbar">
              <span className="bulk-count">{selected.size} selected</span>
              <button className="action-btn accept-btn" onClick={() => handleBulkAction('accepted')} disabled={bulkLoading}>
                Accept all
              </button>
              <button className="action-btn deny-btn" onClick={() => handleBulkAction('denied')} disabled={bulkLoading}>
                Deny all
              </button>
              <button className="action-btn pending-btn" onClick={() => handleBulkAction('pending')} disabled={bulkLoading}>
                Mark pending
              </button>
              <button className="action-btn delete-btn" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}>
                Delete all
              </button>
              <button className="bulk-clear" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            </div>
          )}
          <table className="admin-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && selected.size === visible.length}
                    ref={el => el && (el.indeterminate = selected.size > 0 && selected.size < visible.length)}
                    onChange={() => toggleSelectAll(visible.map(r => r.id))}
                  />
                </th>
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
                <tr key={r.id} className={`row-${r.status}${selected.has(r.id) ? ' row-selected' : ''}`}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
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
                    {r.status !== 'pending' && (
                      <button
                        className="action-btn pending-btn"
                        onClick={() => updateStatus(r.id, 'pending')}
                        disabled={actionLoading === r.id + 'pending'}
                      >
                        Pending
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

      </>}

      {/* ── DB panel ── */}
      {menuOpen && <MenuManager password={password} showToast={showToast} />}

      {subscribersOpen && <NewsletterSubscribers password={password} showToast={showToast} />}

      {calendarOpen && <ReservationCalendar reservations={reservations} />}

      {dbOpen && (
        <div className="db-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Database</span>
            <div className="db-tabs">
              {['customers', 'reservations', 'menu_items'].map(t => (
                <button
                  key={t}
                  className={`db-tab${dbTab === t ? ' active' : ''}`}
                  onClick={() => setDbTab(t)}
                >
                  {t}
                  {typeof dbCounts[t] === 'number' && <span className="db-tab-count">{dbCounts[t]}</span>}
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

function ReservationCalendar({ reservations }) {
  const accepted = reservations.filter(reservation => reservation.status === 'accepted')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()))
  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) return null
    return new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1)
  })
  const reservationsByDay = accepted.reduce((groups, reservation) => {
    const key = localDateKey(new Date(reservation.time_slot))
    groups[key] = [...(groups[key] || []), reservation]
    return groups
  }, {})
  const selectedReservations = (reservationsByDay[selectedDay] || [])
    .sort((left, right) => new Date(left.time_slot) - new Date(right.time_slot))
  const defaultHours = Array.from({ length: 6 }, (_, index) => index + 17)
  const reservationHours = selectedReservations.map(reservation => new Date(reservation.time_slot).getHours())
  const hourlySlots = [...new Set([...defaultHours, ...reservationHours])].sort((left, right) => left - right)

  function changeMonth(offset) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(nextMonth)
    setSelectedDay(localDateKey(nextMonth))
  }

  return (
    <section className="calendar-panel">
      <div className="calendar-panel-header">
        <div>
          <h2>Accepted Reservations</h2>
          <p>{accepted.length} confirmed reservation{accepted.length === 1 ? '' : 's'} shown by service time.</p>
        </div>
        <div className="calendar-controls">
          <button className="log-btn" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
          <strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
          <button className="log-btn" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="calendar-layout">
        <div className="calendar-month">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}
          {days.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="calendar-day calendar-day--empty" />
            const key = localDateKey(day)
            const count = (reservationsByDay[key] || []).length
            return (
              <button
                key={key}
                className={`calendar-day${key === selectedDay ? ' active' : ''}${count ? ' has-reservations' : ''}`}
                onClick={() => setSelectedDay(key)}
              >
                <span>{day.getDate()}</span>
                {count > 0 && <b>{count}</b>}
              </button>
            )
          })}
        </div>
        <div className="hourly-schedule">
          <h3>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
          {hourlySlots.map(hour => {
            const slotReservations = selectedReservations.filter(reservation => new Date(reservation.time_slot).getHours() === hour)
            return (
              <div className="hour-slot" key={hour}>
                <time>{formatScheduleHour(hour)}</time>
                <div>
                  {slotReservations.length === 0 ? <span className="hour-empty">No accepted reservations</span> : slotReservations.map(reservation => (
                    <article key={reservation.id} className="schedule-reservation">
                      <strong>{reservation.name}</strong>
                      <span>Table {reservation.table_number} · {reservation.guests} guest{reservation.guests === 1 ? '' : 's'} · {formatTimeOnly(reservation.time_slot)}</span>
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function NewsletterSubscribers({ password, showToast }) {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSubscribers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/newsletter-subscribers', {
        headers: { 'X-Admin-Password': password },
      })
      const data = await res.json()
      if (res.ok) setSubscribers(Array.isArray(data) ? data : [])
      else showToast(data.error || 'Failed to load subscribers.', 'error')
    } catch {
      showToast('Failed to load subscribers.', 'error')
    } finally {
      setLoading(false)
    }
  }, [password, showToast])

  useEffect(() => { loadSubscribers() }, [loadSubscribers])

  return (
    <section className="subscribers-panel">
      <div className="subscribers-panel-header">
        <div>
          <h2>Newsletter Subscribers</h2>
          <p>{subscribers.length} opted-in email{subscribers.length === 1 ? '' : 's'}</p>
        </div>
        <button className="log-btn" onClick={loadSubscribers} disabled={loading}>Refresh</button>
      </div>
      {loading ? (
        <div className="admin-empty">Loading subscribers…</div>
      ) : subscribers.length === 0 ? (
        <div className="admin-empty">No newsletter subscribers yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table subscribers-table">
            <thead><tr><th>Email address</th><th>Recorded</th></tr></thead>
            <tbody>
              {subscribers.map(subscriber => (
                <tr key={subscriber.email}>
                  <td>{subscriber.email}</td>
                  <td>{formatDate(subscriber.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function MenuManager({ password, showToast }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY_MENU_ITEM)
  const [editingId, setEditingId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/menu-items', { headers: { 'X-Admin-Password': password } })
      const data = await res.json()
      if (res.ok) setItems(Array.isArray(data) ? data : [])
      else showToast(data.error || 'Failed to load menu.', 'error')
    } catch {
      showToast('Failed to load menu.', 'error')
    } finally {
      setLoading(false)
    }
  }, [password, showToast])

  useEffect(() => { loadItems() }, [loadItems])

  function resetForm() {
    setForm(EMPTY_MENU_ITEM)
    setEditingId(null)
    setImageFile(null)
  }

  function editItem(item) {
    setForm({ category: item.category, name: item.name, description: item.description, price: item.price.toFixed(2), image_url: item.image_url || '', display_order: item.display_order })
    setEditingId(item.id)
    setImageFile(null)
  }

  async function saveItem(event) {
    event.preventDefault()
    setSaving(true)
    const data = new FormData()
    Object.entries(form).forEach(([key, value]) => data.append(key, value))
    if (imageFile) data.append('image', imageFile)
    try {
      const res = await fetch(editingId ? `/api/admin/menu-items/${editingId}` : '/api/admin/menu-items', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'X-Admin-Password': password },
        body: data,
      })
      const response = await res.json()
      if (!res.ok) {
        showToast(response.error || 'Unable to save menu item.', 'error')
        return
      }
      setItems(current => editingId ? current.map(item => item.id === response.id ? response : item) : [...current, response])
      showToast(editingId ? 'Menu item updated.' : 'Menu item added.')
      resetForm()
    } catch {
      showToast('Network error while saving menu item.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name} from the menu?`)) return
    try {
      const res = await fetch(`/api/admin/menu-items/${item.id}`, { method: 'DELETE', headers: { 'X-Admin-Password': password } })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Unable to delete menu item.', 'error')
        return
      }
      setItems(current => current.filter(menuItem => menuItem.id !== item.id))
      if (editingId === item.id) resetForm()
      showToast('Menu item deleted.')
    } catch {
      showToast('Network error while deleting menu item.', 'error')
    }
  }

  return (
    <section className="menu-manager">
      <div className="menu-manager-heading">
        <div>
          <h2>Menu Manager</h2>
          <p>Add dishes, update descriptions and pricing, or upload a replacement photo.</p>
        </div>
        <button className="log-btn" onClick={loadItems} disabled={loading}>Refresh</button>
      </div>

      <form className="menu-editor" onSubmit={saveItem}>
        <label>Category
          <select value={form.category} onChange={e => setForm(current => ({ ...current, category: e.target.value }))}>
            {MENU_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>Item name<input required value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /></label>
        <label>Price<input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(current => ({ ...current, price: e.target.value }))} /></label>
        <label>Display order<input type="number" value={form.display_order} onChange={e => setForm(current => ({ ...current, display_order: e.target.value }))} /></label>
        <label className="menu-editor-description">Description<textarea required rows="3" value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} /></label>
        <label>Image URL <span>(optional)</span><input type="url" placeholder="https://…" value={form.image_url} onChange={e => setForm(current => ({ ...current, image_url: e.target.value }))} /></label>
        <label>Upload photo <span>(JPG, PNG, WebP; max 5 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageFile(e.target.files?.[0] || null)} /></label>
        <div className="menu-editor-actions">
          <button className="action-btn accept-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add menu item'}</button>
          {editingId && <button className="action-btn pending-btn" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <div className="admin-loading">Loading menu…</div> : (
        <div className="menu-manager-list">
          {items.map(item => (
            <article key={item.id} className="menu-manager-item">
              {item.image_url ? <img src={item.image_url} alt="" /> : <div className="menu-manager-no-image">No photo</div>}
              <div className="menu-manager-item-copy">
                <span className="menu-manager-category">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <strong>${item.price.toFixed(2)}</strong>
              <div className="res-actions">
                <button className="action-btn pending-btn" onClick={() => editItem(item)}>Edit</button>
                <button className="action-btn delete-btn" onClick={() => deleteItem(item)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatScheduleHour(hour) {
  return new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
}

function formatTimeOnly(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
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
