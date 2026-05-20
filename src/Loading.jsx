import React from 'react'

export default function Loading(){
  return (
    <div className="loading-screen">
      <div className="loading-inner">
        <p className="eyebrow">FinSecure</p>
        <svg className="spinner" width="80" height="80" viewBox="0 0 50 50">
          <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" strokeLinecap="round"></circle>
        </svg>
        <h1>FinSecure</h1>
        <p className="loading-sub">Preparing the review workspace...</p>
      </div>
    </div>
  )
}
