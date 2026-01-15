import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Pending from "./pages/Pending"
import Dashboard from "./pages/Dashboard"
import { Toaster } from "react-hot-toast"
import RequireActive from "./components/RequireActive"
import RequirePending from "./components/RequirePending"


function App() {

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace/>} />
          <Route path="/login" element={<Login/>}/>
          <Route path="/signup" element={<Signup/>}/>

           {/* Require Pending for protection */}
          <Route element={<RequirePending/>}>
            <Route path="/pending" element={<Pending/>}/>
          </Route>

          {/* Protected Route */}
          <Route element={<RequireActive/>}>
            <Route path="/dashboard" element={<Dashboard/>} />
          </Route>

          <Route path="*" element={<div className="p-6">404</div>}/>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
        }}
      />
    </>
  )
}

export default App
