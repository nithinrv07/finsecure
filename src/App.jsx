import React, { useEffect, useState } from 'react'
import { 
  Shield, 
  Activity, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Layout,
  Search,
  Bell,
  Filter,
  Settings,
  LogOut,
  ArrowRight,
  Plus,
  BarChart3,
  FileCheck,
  Zap
} from 'lucide-react'
import Loading from './Loading'
import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { onValue, push, ref, serverTimestamp } from 'firebase/database'

const features = [
  {
    title: 'Document Verification',
    icon: <Shield size={24} />,
    description:
      'Review identity records, income proofs, and supporting files with structured validation checks.',
  },
  {
    title: 'Risk Analysis',
    icon: <BarChart3 size={24} />,
    description:
      'Highlight inconsistencies early with scoring that helps teams prioritize suspicious submissions.',
  },
  {
    title: 'Case Workflow',
    icon: <Zap size={24} />,
    description:
      'Move from intake to review to decision with a workflow that keeps each step easy to follow.',
  },
  {
    title: 'Audit Trail',
    icon: <FileCheck size={24} />,
    description:
      'Maintain a clear record of decisions, reviewer notes, and outcomes for every case.',
  },
]

const reasons = [
  {
    title: 'Built for Review Teams',
    description: 'A clean layout keeps each case readable so analysts can focus on the evidence.',
  },
  {
    title: 'Fast Triage',
    description: 'High-risk files surface quickly, which reduces time spent on low-priority reviews.',
  },
  {
    title: 'Consistent Decisions',
    description: 'Review criteria stay visible across teams so outcomes are easier to standardize.',
  },
  {
    title: 'Easy to Extend',
    description: 'The interface supports new rules and review steps without adding visual clutter.',
  },
]

const metrics = [
  { value: '3x', label: 'Faster review routing' },
  { value: '98%', label: 'Case traceability' },
  { value: '24/7', label: 'Monitoring readiness' },
]

export default function App() {
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => localStorage.getItem('finsecure-view') || 'landing')
  const [modalType, setModalType] = useState(() => localStorage.getItem('finsecure-modalType') || 'register')
  const [modalStep, setModalStep] = useState(() => localStorage.getItem('finsecure-modalStep') || 'role')
  const [activeTab, setActiveTab] = useState('overview')
  const [user, setUser] = useState({ name: 'Guest', accountNumber: '---' })
  const [adminCredentials, setAdminCredentials] = useState({ adminEmail: '', password: '' })
  const [adminAuthError, setAdminAuthError] = useState('')
  const [adminAuthLoading, setAdminAuthLoading] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [selectedApp, setSelectedApp] = useState(null)
  const [allApplications, setAllApplications] = useState([
    {
      id: 'APP-8421',
      customer: 'Sarah Jenkins',
      amount: '$125,000',
      score: 82,
      status: 'Suspicious',
      time: '12 mins ago',
      documents: [
        { id: 1, name: 'ID_Card_Front.jpg', status: 'flagged', type: 'JPG', size: '2.4 MB', uploadedAt: '10:45 AM' },
        { id: 2, name: 'Tax_Return_2023.pdf', status: 'verified', type: 'PDF', size: '4.1 MB', uploadedAt: '10:47 AM' }
      ]
    },
    {
      id: 'APP-7732',
      customer: 'Michael Chen',
      amount: '$45,000',
      score: 14,
      status: 'Approved',
      time: '2 hours ago',
      documents: [
        { id: 3, name: 'Passport_Copy.pdf', status: 'verified', type: 'PDF', size: '1.8 MB', uploadedAt: 'Yesterday' }
      ]
    },
    {
      id: 'APP-9012',
      customer: 'Elena Rodriguez',
      amount: '$210,000',
      score: 45,
      status: 'Pending Review',
      time: '5 hours ago',
      documents: [
        { id: 4, name: 'Bank_Statement_March.pdf', status: 'scanning', type: 'PDF', size: '3.2 MB', uploadedAt: '08:30 AM' }
      ]
    },
    {
      id: 'APP-5521',
      customer: 'David Smith',
      amount: '$12,500',
      score: 5,
      status: 'Approved',
      time: '1 day ago',
      documents: [
        { id: 5, name: 'Driving_License.png', status: 'verified', type: 'PNG', size: '1.2 MB', uploadedAt: '2 days ago' }
      ]
    }
  ])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [scanningDoc, setScanningDoc] = useState(null)
  const [showReport, setShowReport] = useState(null)
  const [liveAlerts, setLiveAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertFilter, setAlertFilter] = useState('all')

  const fileInputRef = React.useRef(null)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  useEffect(() => {
    const alertsRef = ref(db, 'alerts')

    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val() || {}
      const nextAlerts = Object.entries(data)
        .map(([id, alert]) => ({ id, ...alert }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setLiveAlerts(nextAlerts)
      setAlertsLoading(false)
    }, () => {
      setAlertsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAdminUser(currentUser)
      if (currentUser && view === 'adminDashboard') {
        setActiveTab('adminOverview')
      }
      if (!currentUser && view === 'adminDashboard') {
        setView('landing')
      }
    })

    return () => unsubscribe()
  }, [view])

  const formatAlertTime = (createdAt) => {
    if (!createdAt) return 'Just now'
    const value = typeof createdAt === 'number'
      ? createdAt
      : createdAt?.seconds
        ? createdAt.seconds * 1000
        : Date.now()
    return new Date(value).toLocaleString()
  }

  const getAlertTone = (score = 0) => {
    if (score >= 75) return { label: 'Red', className: 'danger', filter: 'red' }
    if (score >= 40) return { label: 'Amber', className: 'warning', filter: 'amber' }
    return { label: 'Green', className: 'success', filter: 'green' }
  }

  const filteredAlerts = liveAlerts.filter((alert) => {
    if (alertFilter === 'all') return true
    return getAlertTone(alert.score).filter === alertFilter
  })

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    // Real upload: send PDF to backend /scan endpoint
    setIsUploading(true)
    setUploadProgress(5)

    const form = new FormData()
    form.append('file', file)

    fetch(`${API_URL}/scan`, {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      setUploadProgress(40)
      setIsUploading(false)
      if (!res.ok) throw new Error('Scan failed')
      const json = await res.json()
      const newDoc = {
        id: Date.now(),
        name: file.name,
        status: json.score >= 60 ? 'verified' : 'flagged',
        type: file.name.split('.').pop().toUpperCase(),
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        uploadedAt: new Date().toLocaleTimeString(),
        analysis: json
      }

      try {
        await push(ref(db, 'alerts'), {
          customer: user.name,
          fileName: file.name,
          score: json.score,
          flags: json.flags || [],
          tamperSignals: json.tamper_signals || [],
          avgOcrConfidence: json.avg_ocr_confidence ?? null,
          status: newDoc.status,
          createdAt: serverTimestamp(),
        })
      } catch (firebaseError) {
        console.error('Firebase write failed:', firebaseError)
      }

      setAllApplications(prev => [{
        id: `APP-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: user.name,
        amount: '$45,000',
        score: newDoc.analysis.score,
        status: newDoc.status === 'flagged' ? 'Suspicious' : 'Pending Review',
        time: 'Just now',
        documents: [newDoc, ...prev[0]?.documents || []]
      }, ...prev.slice(1)])

      setShowReport(newDoc)
      setUploadProgress(100)
    }).catch((err) => {
      setIsUploading(false)
      setUploadProgress(0)
      console.error(err)
      alert('Upload failed: ' + err.message)
    })
  }

  const generateMockAnalysis = (fileName) => {
    const isSuspicious = fileName.toLowerCase().includes('fake') || fileName.toLowerCase().includes('edited') || Math.random() > 0.7
    
    if (isSuspicious) {
      return {
        score: Math.floor(Math.random() * 40),
        trustLevel: 'Low',
        extractedData: {
          'Name': 'John Doe (Inconsistent)',
          'ID Number': 'Unknown',
          'Issue Date': '01/01/2000'
        },
        errors: [
          'Digital manipulation detected in signature area',
          'Metadata indicates file was edited in Adobe Photoshop',
          'Font mismatch in name field',
          'Low resolution capture suggests screen-rephoto'
        ],
        checks: [
          { label: 'Integrity Check', status: 'fail' },
          { label: 'Metadata Audit', status: 'fail' },
          { label: 'Face Match', status: 'pass' },
          { label: 'Document Expiry', status: 'pass' }
        ]
      }
    }
    
    return {
      score: 85 + Math.floor(Math.random() * 15),
      trustLevel: 'High',
      extractedData: {
        'Name': user.name,
        'ID Number': 'TX-' + Math.floor(100000 + Math.random() * 800000),
        'Issue Date': '12/05/2022'
      },
      errors: [],
      checks: [
        { label: 'Integrity Check', status: 'pass' },
        { label: 'Metadata Audit', status: 'pass' },
        { label: 'Face Match', status: 'pass' },
        { label: 'Document Expiry', status: 'pass' }
      ]
    }
  }

  const triggerUpload = () => fileInputRef.current?.click()

  useEffect(() => {
    localStorage.setItem('finsecure-view', view)
    localStorage.setItem('finsecure-modalType', modalType)
    localStorage.setItem('finsecure-modalStep', modalStep)
  }, [view, modalType, modalStep])

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <Loading />

  // Derived data
  const currentUserApp = allApplications.find(a => a.customer === user.name) || { documents: [], score: 0, status: 'N/A' }
  const documents = currentUserApp.documents || []

  const stats = [
    { label: 'Loan Amount', value: currentUserApp.amount || '$0', icon: <DollarSign size={20} /> },
    { label: 'Documents Uploaded', value: `${documents.filter(d => d.status === 'verified').length} / ${Math.max(6, documents.length)}`, icon: <FileText size={20} /> },
    { label: 'Trust Score', value: `${currentUserApp.score}/100`, icon: <Activity size={20} />, status: currentUserApp.score > 70 ? 'danger' : currentUserApp.score > 30 ? 'warning' : 'success' },
    { label: 'Application Status', value: currentUserApp.status || 'Pending', icon: <CheckCircle size={20} />, status: 'review' },
  ]

  const progressSteps = [
    { step: 1, label: 'Submission', status: documents.length > 0 ? 'completed' : 'current', date: 'May 10, 2026' },
    { step: 2, label: 'Document Verification', status: documents.length > 2 ? 'completed' : documents.length > 0 ? 'current' : 'pending', date: 'In Progress' },
    { step: 3, label: 'Risk Analysis', status: 'pending', date: '---' },
    { step: 4, label: 'Review Team', status: 'pending', date: '---' },
    { step: 5, label: 'Final Decision', status: 'pending', date: '---' },
  ]

  if (view === 'dashboard') {
    return (
      <div className="dashboard-root">
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
        <aside className="dashboard-sidebar">
          <div className="logo" onClick={() => setView('landing')} style={{ cursor: 'pointer', padding: '24px' }}>
            <span className="logo-mark">F</span>
            <span>FinSecure</span>
          </div>
          <nav className="side-nav">
            <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><Layout size={18} /> Overview</button>
            <button className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}><FileText size={18} /> Documents</button>
            <button className={`nav-item ${activeTab === 'tracking' ? 'active' : ''}`} onClick={() => setActiveTab('tracking')}><Activity size={18} /> Tracking</button>
            <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}><Bell size={18} /> Notifications</button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><Settings size={18} /> Settings</button>
          </nav>
          <div className="sidebar-footer">
            <button className="btn ghost full-width" onClick={() => { localStorage.clear(); window.location.reload(); }}><LogOut size={18} /> Sign Out</button>
          </div>
        </aside>

        <main className="dashboard-main">
          {activeTab === 'overview' && (
            <>
              <header className="dashboard-header">
                <div className="welcome-banner">
                  <div className="welcome-content">
                    <h1>Welcome back, {user.name}</h1>
                    <p>
                      {documents.length === 0 
                        ? 'Ready to start? Upload your first document to begin your loan journey.'
                        : `Great job! You have ${documents.length} documents uploaded. Our team is reviewing them.`
                      }
                    </p>
                  </div>
                  <div className="welcome-action">
                    <button className="btn primary" onClick={() => setActiveTab('documents')}>
                      {documents.length === 0 ? 'Start Application' : 'Resume Application'}
                    </button>
                  </div>
                </div>
              </header>

              <section className="dashboard-content">
                <div className="stats-grid">
                  {stats.map((stat) => (
                    <div className="stat-card" key={stat.label}>
                      <div className="stat-icon">{stat.icon}</div>
                      <div className="stat-info">
                        <span className="stat-label">{stat.label}</span>
                        <strong className={`stat-value ${stat.status || ''}`}>{stat.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="progress-tracker-card">
                  <div className="section-header">
                    <h3>Application Progress</h3>
                    <button className="btn-link" onClick={() => setActiveTab('tracking')}>View Detailed Timeline</button>
                  </div>
                  <div className="progress-steps">
                    {progressSteps.map((s, i) => (
                      <div className={`step-item ${s.status}`} key={s.label}>
                        <div className="step-number">{s.status === 'completed' ? 'Done' : s.step}</div>
                        <span className="step-label">{s.label}</span>
                        {i < progressSteps.length - 1 && <div className="step-line"></div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dashboard-grid">
                  <div className="document-section">
                    <div className="section-header">
                      <h3>Your Documents</h3>
                      <span className="count-tag">{documents.length} Files</span>
                    </div>
                    {documents.length > 0 ? (
                          <div className="doc-list">
                            {documents.map((doc) => (
                              <div className="doc-item" key={doc.id} onClick={() => doc.analysis && setShowReport(doc)} style={{ cursor: doc.analysis ? 'pointer' : 'default' }}>
                                <div className="doc-icon">{doc.type}</div>
                                <div className="doc-info">
                                  <strong>{doc.name}</strong>
                                  <span>{doc.type} • {doc.size}</span>
                                </div>
                                <div className={`doc-status ${doc.status}`}>
                                  {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                </div>
                                {doc.analysis && <div className="doc-score-tag">{doc.analysis.score}</div>}
                              </div>
                            ))}
                          </div>
                    ) : (
                      <div className="empty-state">
                        <p>No documents uploaded yet.</p>
                      </div>
                    )}
                  </div>

                  <div className="upload-zone-card" onClick={triggerUpload} style={{ cursor: 'pointer' }}>
                    <div className="upload-icon"></div>
                    <h3>Upload New Document</h3>
                    <p>Drag and drop your files here, or click to browse</p>
                    <div className="upload-hints">
                      <span>PDF, JPG, PNG up to 10MB</span>
                    </div>
                    <button className="btn ghost full-width" style={{ marginTop: '20px' }}>Select Files</button>
                    {documents.length === 0 && (
                      <div className="pending-nudges">
                        <p><strong>Suggested:</strong> Identity Proof, Income Statement</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'documents' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Document Upload</h1>
                  <p>Submit and manage your required documentation.</p>
                </div>
                <button className="btn primary" onClick={triggerUpload}>+ Upload Document</button>
              </header>

              <div className="upload-container">
                <div className="upload-main-zone" onClick={triggerUpload} style={{ cursor: 'pointer' }}>
                  <div className="upload-art"></div>
                  <h2>Drop files here to upload</h2>
                  <p>Support for PDF, DOCX, and high-quality images</p>
                  <button className="btn primary">Browse Files</button>
                </div>

                {(isUploading || uploadProgress > 0) && (
                  <div className="upload-progress-section">
                    <h3>{isUploading ? 'Current Upload' : 'Recent Upload'}</h3>
                    <div className="progress-list">
                      <div className="progress-item">
                        <div className="progress-info">
                          <strong>{isUploading ? 'Processing your file...' : 'Upload Complete'}</strong>
                          <span>{uploadProgress}% • {isUploading ? 'Uploading...' : 'Done'}</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className={`progress-bar-fill ${isUploading ? 'animated' : ''}`} 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="document-inventory">
                  <h3>Document Status</h3>
                  {documents.length > 0 ? (
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Type</th>
                          <th>Date Uploaded</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map(doc => (
                          <tr key={doc.id}>
                            <td><strong>{doc.name}</strong></td>
                            <td>{doc.type}</td>
                            <td>{doc.uploadedAt || 'Just now'}</td>
                            <td><span className={`doc-status ${doc.status}`}>{doc.status}</span></td>
                            <td><button className="btn ghost sm" onClick={() => doc.analysis && setShowReport(doc)}>View Report</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <p>Start by uploading your first document.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tracking' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Application Tracking</h1>
                  <p>Follow your loan application through each stage of the review process.</p>
                </div>
                <div className="status-badge large">{currentUserApp.status || 'Not Started'}</div>
              </header>

              <div className="timeline-container">
                <div className="timeline-summary-card">
                  <div className="summary-item">
                    <span>Estimated Completion</span>
                    <strong>{documents.length > 0 ? '7-10 Days' : '---'}</strong>
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-item">
                    <span>Current Stage</span>
                    <strong>{progressSteps.find(s => s.status === 'current')?.label || 'Awaiting Submission'}</strong>
                  </div>
                  <div className="summary-divider"></div>
                  <div className="summary-item">
                    <span>Time Elapsed</span>
                    <strong>{documents.length > 0 ? 'Just Started' : '0 Days'}</strong>
                  </div>
                </div>

                <div className="timeline-steps">
                  {progressSteps.map((step) => (
                    <div className={`timeline-item ${step.status}`} key={step.step}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <h3>{step.label}</h3>
                          <span className="timeline-date">{documents.length > 0 ? 'Update: Now' : '---'}</span>
                        </div>
                        <p>
                          {step.status === 'completed' && 'This stage was successfully completed.'}
                          {step.status === 'current' && 'Our team is currently reviewing your application details.'}
                          {step.status === 'pending' && 'This stage will begin once previous steps are finalized.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Officer Alerts</h1>
                  <p>Live scan results from Firebase Realtime Database.</p>
                </div>
                <div className="status-badge large">{liveAlerts.length} live</div>
              </header>

              <div className="section-header" style={{ marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>Risk Filters</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className={`btn ghost sm ${alertFilter === 'all' ? 'active' : ''}`} onClick={() => setAlertFilter('all')}>All</button>
                  <button className={`btn ghost sm ${alertFilter === 'red' ? 'active' : ''}`} onClick={() => setAlertFilter('red')}>Red</button>
                  <button className={`btn ghost sm ${alertFilter === 'amber' ? 'active' : ''}`} onClick={() => setAlertFilter('amber')}>Amber</button>
                  <button className={`btn ghost sm ${alertFilter === 'green' ? 'active' : ''}`} onClick={() => setAlertFilter('green')}>Green</button>
                </div>
              </div>

              <div className="notification-list">
                {alertsLoading && (
                  <div className="notification-card info">
                    <div className="notif-icon">...</div>
                    <div className="notif-content">
                      <div className="notif-header">
                        <h3>Loading live alerts</h3>
                        <span className="notif-time">Please wait</span>
                      </div>
                      <p>Listening for new scan results from Firebase.</p>
                    </div>
                  </div>
                )}

                {!alertsLoading && liveAlerts.length === 0 && (
                  <div className="notification-card info">
                    <div className="notif-icon"><Bell size={18} /></div>
                    <div className="notif-content">
                      <div className="notif-header">
                        <h3>No alerts yet</h3>
                        <span className="notif-time">Waiting for scans</span>
                      </div>
                      <p>Upload a PDF to generate a live officer alert.</p>
                    </div>
                  </div>
                )}

                {!alertsLoading && liveAlerts.length > 0 && filteredAlerts.length === 0 && (
                  <div className="notification-card info">
                    <div className="notif-icon"><Filter size={18} /></div>
                    <div className="notif-content">
                      <div className="notif-header">
                        <h3>No alerts in this risk band</h3>
                        <span className="notif-time">Try a different filter</span>
                      </div>
                      <p>The selected risk filter does not match any current alerts.</p>
                    </div>
                  </div>
                )}

                {filteredAlerts.slice(0, 20).map((alert) => {
                  const tone = getAlertTone(alert.score)
                  return (
                    <div className={`notification-card ${tone.className}`} key={alert.id}>
                      <div className="notif-icon">{tone.label[0]}</div>
                      <div className="notif-content">
                        <div className="notif-header">
                          <h3>{alert.fileName || 'Document Scan'}</h3>
                          <span className="notif-time">{formatAlertTime(alert.createdAt)}</span>
                        </div>
                        <p>
                          Score {alert.score ?? 'N/A'} • {tone.label} risk • {alert.customer || 'Unknown applicant'}
                        </p>
                        <p>
                          {Array.isArray(alert.flags) && alert.flags.length > 0
                            ? `Flags: ${alert.flags.join(', ')}`
                            : 'No flags reported.'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Account Settings</h1>
                  <p>Manage your profile and security preferences.</p>
                </div>
              </header>

              <div className="settings-grid">
                <div className="settings-card">
                  <h3>Profile Information</h3>
                  <div className="settings-form">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input type="text" defaultValue={user.name} />
                    </div>
                    <button className="btn primary">Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {scanningDoc && (
          <div className="scanning-overlay">
            <div className="scanning-modal">
              <div className="scanner-line"></div>
              <div className="scanning-content">
                <div className="ai-brain-icon">AI</div>
                <h2>AI Scanning in Progress</h2>
                <p>Analyzing <strong>{scanningDoc.name}</strong> for security patterns...</p>
                <div className="scanning-metrics">
                  <span>Extracting Metadata...</span>
                  <span>Verifying Font Signatures...</span>
                  <span>Checking Digital Integrity...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showReport && (
          <div className="report-overlay" onClick={() => setShowReport(null)}>
            <div className="report-modal" onClick={e => e.stopPropagation()}>
              <header className="report-header">
                <div className="report-title">
                  <h2>AI Analysis Report</h2>
                  <p>{showReport.name} • {showReport.type}</p>
                </div>
                <div className={`report-score-circle ${showReport.analysis?.score >= 75 ? 'low' : showReport.analysis?.score >= 50 ? 'medium' : 'high'}`}>
                  <span className="score-val">{showReport.analysis?.score}</span>
                  <span className="score-label">Risk Score</span>
                </div>
                <button className="report-close" onClick={() => setShowReport(null)}>&times;</button>
              </header>
              
              <div className="report-body">
                <div className="report-grid">
                  <div className="report-main">
                    {Object.entries(showReport.analysis?.extractedData || {}).length > 0 ? (
                      <section className="extracted-data">
                        <h3>Extracted Information</h3>
                        <div className="data-grid">
                          {Object.entries(showReport.analysis.extractedData).map(([key, val]) => (
                            <div className="data-item" key={key}>
                              <label>{key}</label>
                              <strong>{val}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : showReport.analysis?.explanation ? (
                      <section className="extracted-data">
                        <h3>Analysis Summary</h3>
                        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{showReport.analysis.explanation}</p>
                      </section>
                    ) : null}
                    
                    {Array.isArray(showReport.analysis?.checks) && (
                      <section className="validation-checks">
                        <h3>Security Checks</h3>
                        <div className="checks-list">
                          {showReport.analysis.checks.map(check => (
                            <div className="check-row" key={check.label}>
                              <span>{check.label}</span>
                              <span className={`check-badge ${check.status}`}>{check.status.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {Array.isArray(showReport.analysis?.scoring_breakdown) && (
                      <section className="validation-checks">
                        <h3>Scoring Breakdown</h3>
                        <div className="checks-list">
                          {showReport.analysis.scoring_breakdown.map((item) => (
                            <div className="check-row" key={item.category}>
                              <div>
                                <span style={{ display: 'block', fontWeight: 700 }}>{item.category}</span>
                                <small style={{ color: 'var(--muted)' }}>{item.evidence?.join(', ') || 'No issues detected'}</small>
                              </div>
                              <span className="check-badge warning">{item.penalty}/{item.max}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  
                  <div className="report-side">
                    {showReport.analysis?.confidence && (
                      <div className="success-card" style={{ marginBottom: '16px' }}>
                        <div className="success-icon">i</div>
                        <h3>Analysis Confidence</h3>
                        <p>
                          {showReport.analysis.confidence.level.toUpperCase()} confidence • {showReport.analysis.confidence.score}/100
                        </p>
                      </div>
                    )}

                    {showReport.analysis?.recommendation && (
                      <div className="success-card" style={{ marginBottom: '16px' }}>
                        <div className="success-icon">→</div>
                        <h3>Recommendation</h3>
                        <p>{showReport.analysis.recommendation}</p>
                      </div>
                    )}

                    {showReport.analysis?.errors.length > 0 ? (
                      <div className="error-card">
                        <h3>Critical Errors Detected</h3>
                        <ul>
                          {showReport.analysis.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="success-card">
                        <div className="success-icon">✓</div>
                        <h3>Clean Scan</h3>
                        <p>No anomalies detected. Document integrity verified.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <footer className="report-footer">
                <button className="btn primary" onClick={() => setShowReport(null)}>Done</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (view === 'login' || view === 'register') {
    return (
      <div className="auth-page">
        <header className="auth-header">
          <div className="container header-inner">
            <div className="logo" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
              <span className="logo-mark">F</span>
              <span>FinSecure</span>
            </div>
            <button className="btn ghost" onClick={() => setView('landing')}>Back to Home</button>
          </div>
        </header>

        <main className="auth-main">
          <div className="auth-card">
            {modalStep === 'role' ? (
              <>
                <div className="modal-header">
                  <h2>{modalType === 'login' ? 'Sign in to FinSecure' : 'Create an account'}</h2>
                  <p>Please select your role to continue.</p>
                </div>
                <div className="role-options">
                  <button className="role-btn" onClick={() => setModalStep('form')}>
                    <div className="role-text">
                      <strong>Customer</strong>
                      <span>Access your dashboard and records</span>
                    </div>
                  </button>
                  <button className="role-btn" onClick={() => { setAdminAuthError(''); setModalStep('adminForm'); }}>
                    <div className="role-text">
                      <strong>Admin</strong>
                      <span>Manage system rules and teams</span>
                    </div>
                  </button>
                </div>
              </>
            ) : modalStep === 'adminForm' ? (
              <>
                <button className="modal-back" onClick={() => setModalStep('role')}>Back</button>
                <div className="modal-header">
                  <h2>{modalType === 'login' ? 'Admin Sign in' : 'Admin Access'}</h2>
                  <p>Enter your admin email and password to continue.</p>
                </div>
                <form
                  className="register-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setAdminAuthError('')
                    setAdminAuthLoading(true)

                    try {
                      await signInWithEmailAndPassword(auth, adminCredentials.adminEmail.trim(), adminCredentials.password)

                      setView('adminDashboard')
                      setActiveTab('adminOverview')
                      setModalStep('role')
                    } catch (error) {
                      setAdminAuthError(error?.message || 'Unable to verify admin credentials')
                    } finally {
                      setAdminAuthLoading(false)
                    }
                  }}
                >
                  <div className="form-group">
                    <label htmlFor="admin-email">Admin Email</label>
                    <input
                      type="email"
                      id="admin-email"
                      placeholder="admin@example.com"
                      required
                      value={adminCredentials.adminEmail}
                      onChange={(e) => setAdminCredentials(prev => ({ ...prev, adminEmail: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="admin-pass">Password</label>
                    <input
                      type="password"
                      id="admin-pass"
                      placeholder="••••••••"
                      required
                      value={adminCredentials.password}
                      onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  {adminAuthError && (
                    <div className="form-error" role="alert">{adminAuthError}</div>
                  )}
                  <button type="submit" className="btn primary full-width">
                    {adminAuthLoading ? 'Verifying...' : (modalType === 'login' ? 'Sign in as Admin' : 'Continue as Admin')}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button className="modal-back" onClick={() => setModalStep('role')}>Back</button>
                <div className="modal-header">
                  <h2>{modalType === 'login' ? 'Customer Login' : 'Customer Registration'}</h2>
                  <p>{modalType === 'login' ? 'Welcome back! Please enter your credentials.' : 'Please enter your details to create your account.'}</p>
                </div>
                <form className="register-form" onSubmit={(e) => { e.preventDefault(); setView('dashboard'); }}>
                  {modalType === 'register' && (
                    <div className="form-group">
                      <label htmlFor="reg-name">Full Name</label>
                      <input type="text" id="reg-name" placeholder="John Doe" required onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="reg-acc">Account Number</label>
                    <input type="text" id="reg-acc" placeholder="8822 4499 0011" required onChange={(e) => setUser(prev => ({ ...prev, accountNumber: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-pass">Password</label>
                    <input type="password" id="reg-pass" placeholder="••••••••" required />
                  </div>
                  {modalType === 'register' && (
                    <div className="form-group">
                      <label htmlFor="reg-contact">Contact Number</label>
                      <input type="tel" id="reg-contact" placeholder="+1 (555) 000-0000" required />
                    </div>
                  )}
                  <button type="submit" className="btn primary full-width">
                    {modalType === 'login' ? 'Sign in' : 'Complete Registration'}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (view === 'adminDashboard') {
    const adminStats = [
      { label: 'Total Applications', value: allApplications.length, icon: <FileCheck size={20} /> },
      { label: 'High Risk Count', value: allApplications.filter(a => a.score > 70).length, icon: <AlertTriangle size={20} />, status: 'danger' },
      { label: 'Pending Reviews', value: allApplications.filter(a => a.status !== 'Approved').length, icon: <Clock size={20} />, status: 'warning' },
      { label: 'System Accuracy', value: '99.4%', icon: <Zap size={20} /> },
    ]

    return (
      <div className="dashboard-root admin">
        <aside className="dashboard-sidebar">
          <div className="logo" onClick={() => setView('landing')} style={{ cursor: 'pointer', padding: '24px' }}>
            <span className="logo-mark admin">A</span>
            <span>FinSecure Admin</span>
          </div>
          <nav className="side-nav">
            <button className={`nav-item ${activeTab === 'adminOverview' ? 'active' : ''}`} onClick={() => { setActiveTab('adminOverview'); setSelectedApp(null); }}><BarChart3 size={18} /> Dashboard</button>
            <button className={`nav-item ${activeTab === 'adminQueue' ? 'active' : ''}`} onClick={() => { setActiveTab('adminQueue'); setSelectedApp(null); }}><FileCheck size={18} /> Applications</button>
            <button className={`nav-item ${activeTab === 'adminFraud' ? 'active' : ''}`} onClick={() => { setActiveTab('adminFraud'); setSelectedApp(null); }}><Shield size={18} /> Fraud Cases</button>
            <button className={`nav-item ${activeTab === 'adminUsers' ? 'active' : ''}`} onClick={() => { setActiveTab('adminUsers'); setSelectedApp(null); }}><Users size={18} /> User Management</button>
            <button className={`nav-item ${activeTab === 'adminReports' ? 'active' : ''}`} onClick={() => { setActiveTab('adminReports'); setSelectedApp(null); }}><Activity size={18} /> Reports</button>
            <button className={`nav-item ${activeTab === 'adminSettings' ? 'active' : ''}`} onClick={() => { setActiveTab('adminSettings'); setSelectedApp(null); }}><Settings size={18} /> System Settings</button>
          </nav>
          <div className="sidebar-footer">
            <div className="admin-user-info">
              <strong>{adminUser?.email || 'Admin User'}</strong>
              <span>Firebase Auth</span>
            </div>
            <button className="btn ghost full-width" onClick={async () => { await signOut(auth); setView('landing'); }}>Sign Out</button>
          </div>
        </aside>

        <main className="dashboard-main">
          {activeTab === 'adminOverview' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>System Overview</h1>
                  <p>Real-time monitoring and fraud detection metrics.</p>
                </div>
                <div className="header-actions">
                  <span className="live-indicator">LIVE</span>
                </div>
              </header>

              <div className="admin-stats-grid">
                {adminStats.map(stat => (
                  <div className="admin-stat-card" key={stat.label}>
                    <div className="stat-header">
                      <span className="stat-icon-bg">{stat.icon}</span>
                    </div>
                    <div className="stat-body">
                      <span className="stat-label">{stat.label}</span>
                      <strong className={`stat-value ${stat.status || ''}`}>{stat.value}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-dashboard-grid">
                <div className="real-time-alerts">
                  <div className="section-header">
                    <h3>Recent Fraud Alerts</h3>
                  </div>
                  <div className="alert-list">
                    {allApplications.filter(a => a.score > 70).map(app => (
                      <div className="fraud-alert urgent" key={app.id}>
                        <div className="alert-badge">URGENT</div>
                        <div className="alert-icon-wrap"><AlertTriangle size={24} color="#ef4444" /></div>
                        <div className="alert-info">
                          <strong>High Risk: {app.customer}</strong>
                          <p>Score of {app.score} detected. Manual review required.</p>
                          <span>Just now</span>
                        </div>
                      </div>
                    ))}
                    {allApplications.length === 0 && <p>No active alerts.</p>}
                  </div>
                </div>

                <div className="queue-snapshot">
                  <div className="section-header">
                    <h3>Priority Queue</h3>
                  </div>
                  <div className="snapshot-list">
                    {allApplications.slice(0, 3).map(app => (
                      <div className="snapshot-item" key={app.id}>
                        <div className="app-id">{app.id}</div>
                        <div className="app-user">
                          <strong>{app.customer}</strong>
                          <span>{app.amount}</span>
                        </div>
                        <div className={`app-score-badge ${app.score > 70 ? 'high' : app.score > 30 ? 'medium' : 'low'}`}>
                          {app.score}
                        </div>
                      </div>
                    ))}
                    {allApplications.length === 0 && <p>No pending applications.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adminQueue' && !selectedApp && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Application Queue</h1>
                  <p>Review and triage incoming loan applications.</p>
                </div>
              </header>

              <div className="queue-table-container">
                {allApplications.length > 0 ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>App ID</th>
                        <th>Customer</th>
                        <th>Loan Amount</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allApplications.map(app => (
                        <tr key={app.id} onClick={() => setSelectedApp(app)} style={{ cursor: 'pointer' }}>
                          <td><strong>{app.id}</strong></td>
                          <td>{app.customer}</td>
                          <td>{app.amount}</td>
                          <td>
                            <div className="score-cell">
                              <div className="score-bar-bg"><div className="score-bar-fill" style={{ width: `${app.score}%`, background: app.score > 70 ? '#ef4444' : app.score > 30 ? '#f59e0b' : '#10b981' }}></div></div>
                              <span>{app.score}</span>
                            </div>
                          </td>
                          <td><span className={`status-pill admin ${app.status.replace(' ', '-').toLowerCase()}`}>{app.status}</span></td>
                          <td><button className="btn primary sm">Review</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state"><p>The queue is empty.</p></div>
                )}
              </div>
            </div>
          )}

          {selectedApp && (
            <div className="tab-view detail-view">
              <header className="view-header">
                <div className="back-nav" onClick={() => setSelectedApp(null)} style={{ cursor: 'pointer' }}>
                  <span>Back to Queue</span>
                  <h1>Reviewing {selectedApp.id}: {selectedApp.customer}</h1>
                </div>
                <div className="review-actions">
                  <button className="btn danger" onClick={() => {
                    setAllApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, status: 'Rejected' } : a));
                    setSelectedApp(null);
                  }}>Reject</button>
                  <button className="btn success" onClick={() => {
                    setAllApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, status: 'Approved' } : a));
                    setSelectedApp(null);
                  }}>Approve</button>
                </div>
              </header>

              <div className="review-grid">
                <div className="red-flags-section">
                  <h3>Customer Documents</h3>
                  <div className="doc-list">
                    {selectedApp.documents.map(doc => (
                      <div className="doc-item" key={doc.id}>
                        <div className="doc-icon">{doc.type}</div>
                        <div className="doc-info">
                          <strong>{doc.name}</strong>
                          <span>{doc.type} • {doc.size}</span>
                        </div>
                        <div className={`doc-status ${doc.status}`}>{doc.status}</div>
                        <button className="btn ghost sm" onClick={() => {
                          setAllApplications(prev => prev.map(a => {
                            if (a.id === selectedApp.id) {
                              const updatedDocs = a.documents.map(d => d.id === doc.id ? { ...d, status: 'verified' } : d);
                              return { ...a, documents: updatedDocs, score: Math.max(0, a.score - 20) };
                            }
                            return a;
                          }));
                          setSelectedApp(prev => ({ ...prev, documents: prev.documents.map(d => d.id === doc.id ? { ...d, status: 'verified' } : d), score: Math.max(0, prev.score - 20) }));
                        }}>Verify</button>
                      </div>
                    ))}
                    {selectedApp.documents.length === 0 && <p>No documents uploaded yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adminFraud' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Fraud Cases Management</h1>
                  <p>Track escalated cases and protection metrics.</p>
                </div>
                <div className="protection-metric">
                  <span>Funds Protected This Month</span>
                  <strong>$842,500</strong>
                </div>
              </header>

              <div className="fraud-management-grid">
                <div className="escalated-queue">
                  <h3>Escalated to Fraud Team</h3>
                  <div className="escalated-list">
                    <div className="escalated-card">
                      <div className="esc-header">
                        <strong>APP-8842: Robert Fox</strong>
                        <span className="esc-badge danger">Identity Theft</span>
                      </div>
                      <p>Multiple account applications detected from same IP with different identities.</p>
                      <div className="esc-footer">
                        <span>Escalated by Sarah (Loan Officer)</span>
                        <button className="btn ghost sm">View Case</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="prevention-chart">
                  <h3>Prevention Trends</h3>
                  <div className="mock-chart">
                    {/* Placeholder for a chart */}
                    <div className="chart-bar" style={{ height: '60%' }}></div>
                    <div className="chart-bar" style={{ height: '80%' }}></div>
                    <div className="chart-bar" style={{ height: '45%' }}></div>
                    <div className="chart-bar" style={{ height: '90%' }}></div>
                    <div className="chart-bar" style={{ height: '75%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adminUsers' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>User Management</h1>
                  <p>Manage loan officers and system access.</p>
                </div>
                <button className="btn primary">+ Create New User</button>
              </header>

              <div className="user-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Active</th>
                      <th>Permissions</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Sarah Johnson</strong><br/><span>sarah.j@finsecure.com</span></td>
                      <td>Loan Officer</td>
                      <td><span className="status-pill admin clean">Active</span></td>
                      <td>5 mins ago</td>
                      <td>Review, Request Docs</td>
                      <td><button className="btn ghost sm">Edit</button></td>
                    </tr>
                    <tr>
                      <td><strong>Mark Thompson</strong><br/><span>mark.t@finsecure.com</span></td>
                      <td>Admin</td>
                      <td><span className="status-pill admin clean">Active</span></td>
                      <td>2 hours ago</td>
                      <td>Full Access</td>
                      <td><button className="btn ghost sm">Edit</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'adminReports' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>Reports & Compliance</h1>
                  <p>Export audit logs and detection summaries.</p>
                </div>
              </header>

              <div className="reports-grid">
                <div className="report-card">
                  <div className="report-icon">📄</div>
                  <h3>Daily Fraud Summary</h3>
                  <p>Yesterday's detection metrics and outcome summary.</p>
                  <button className="btn ghost full-width">Download PDF</button>
                </div>
                <div className="report-card">
                  <div className="report-icon">📊</div>
                  <h3>Compliance Audit Log</h3>
                  <p>Full history of all reviewer decisions and timestamps.</p>
                  <button className="btn ghost full-width">Export CSV</button>
                </div>
                <div className="report-card">
                  <div className="report-icon">🔒</div>
                  <h3>System Security Report</h3>
                  <p>Monthly overview of login activity and threat attempts.</p>
                  <button className="btn ghost full-width">Download PDF</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adminSettings' && (
            <div className="tab-view">
              <header className="view-header">
                <div>
                  <h1>System Settings</h1>
                  <p>Configure risk thresholds and document rules.</p>
                </div>
                <button className="btn primary">Save Changes</button>
              </header>

              <div className="settings-grid">
                <div className="settings-card">
                  <h3>Risk Score Thresholds</h3>
                  <div className="setting-item">
                    <label>High Risk (Red Flag)</label>
                    <input type="number" defaultValue={70} />
                    <span>Scores above this will require immediate investigation.</span>
                  </div>
                  <div className="setting-item">
                    <label>Suspicious (Yellow Flag)</label>
                    <input type="number" defaultValue={30} />
                    <span>Scores between this and High Risk will trigger manual review.</span>
                  </div>
                </div>

                <div className="settings-card">
                  <h3>Accepted Documents</h3>
                  <div className="doc-type-toggle">
                    <div className="doc-toggle">
                      <span>Passport / ID</span>
                      <input type="checkbox" defaultChecked />
                    </div>
                    <div className="doc-toggle">
                      <span>Utility Bills</span>
                      <input type="checkbox" defaultChecked />
                    </div>
                    <div className="doc-toggle">
                      <span>Paystubs (Income)</span>
                      <input type="checkbox" defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="page-root">
      <header className="site-header">
        <div className="container header-inner">
          <div className="logo">
            <span className="logo-mark">F</span>
            <span>FinSecure</span>
          </div>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="#features">Capabilities</a>
            <a href="#why">Benefits</a>
            <a href="#contact">Contact</a>
          </nav>
          <nav className="nav-actions">
            <button type="button" className="btn ghost" onClick={() => { setView('register'); setModalType('register'); setModalStep('role'); }}>Register</button>
            <button type="button" className="btn primary" onClick={() => { setView('login'); setModalType('login'); setModalStep('role'); }}>Sign in</button>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Document risk review</p>
            <h1>Clear, professional document screening for faster decisions.</h1>
            <p className="subtitle">
              FinSecure helps teams inspect submitted records with structured checks,
              transparent scoring, and a layout that makes each case easy to scan.
            </p>

            <div className="hero-actions">
              <button type="button" className="btn primary" onClick={() => { setView('register'); setModalType('register'); setModalStep('role'); }}>Start reviewing</button>
              <button type="button" className="btn ghost">See workflow</button>
            </div>

            <div className="trust-row" aria-label="Platform highlights">
              {metrics.map((item) => (
                <div className="trust-item" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-panel" aria-label="Platform overview">
            <div className="panel-card panel-card-top">
              <div>
                <span className="panel-label">Review status</span>
                <h2>Cases are moving through the queue without delays</h2>
              </div>
              <div className="status-pill">Active</div>
            </div>

            <div className="panel-card panel-card-main">
              <div className="panel-graph">
                <div className="graph-bar" style={{ height: '42%' }}></div>
                <div className="graph-bar" style={{ height: '68%' }}></div>
                <div className="graph-bar" style={{ height: '54%' }}></div>
                <div className="graph-bar" style={{ height: '84%' }}></div>
                <div className="graph-bar" style={{ height: '72%' }}></div>
              </div>
              <div className="panel-summary">
                <div>
                  <span className="panel-label">Items reviewed</span>
                  <strong>1,248</strong>
                </div>
                <div>
                  <span className="panel-label">Flag rate</span>
                  <strong>Low</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features container" id="features">
        <div className="section-heading">
          <p className="eyebrow">Core capabilities</p>
          <h2>Every section is aligned around clear review, dependable judgment, and fast routing.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="why container" id="why">
        <div className="section-heading section-heading-center">
          <p className="eyebrow">Why FinSecure</p>
          <h2>Designed to stay balanced, readable, and practical across every device.</h2>
        </div>
        <div className="reason-grid">
          {reasons.map((reason) => (
            <article className="reason-card" key={reason.title}>
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta" id="contact">
        <div className="container cta-inner">
          <div>
            <p className="eyebrow eyebrow-light">Ready to begin</p>
            <h2>Bring more structure and confidence to document review.</h2>
            <p>Use a cleaner workspace to handle submissions with less friction.</p>
          </div>
          <button type="button" className="btn cta-btn">Request a demo</button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="brand-block">
            <div className="brand">FinSecure</div>
            <p>Professional review tools for teams that need clarity, consistency, and control.</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>Product</strong>
              <ul>
                <li>Capabilities</li>
                <li>Workflow</li>
                <li>Reporting</li>
              </ul>
            </div>
            <div>
              <strong>Review</strong>
              <ul>
                <li>Scoring</li>
                <li>Audit trail</li>
                <li>Alerts</li>
              </ul>
            </div>
            <div>
              <strong>Company</strong>
              <ul>
                <li>About</li>
                <li>Partners</li>
                <li>Careers</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

