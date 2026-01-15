import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Pending from "./pages/Pending"
import Dashboard from "./pages/Dashboard"
import { Toaster } from "react-hot-toast"

import RequireActive from "./components/RequireActive"
import RequirePending from "./components/RequirePending"
import EmployeeLayout from "./layouts/EmployeeLayout"
import RequireAdmin from "./components/RequireAdmin"
import AdminLayout from "./layouts/AdminLayout"
import AdminUsers from "./pages/admin/AdminUsers"


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


          {/* Employee protected area */}
          <Route element={<RequireActive/>}>
            <Route element={<EmployeeLayout/>}>
              <Route path="/dashboard" element={<Dashboard/>}/>
            </Route>     
          </Route>
   

          {/* Admin protected area */}
          <Route element={<RequireAdmin/>}>
            <Route element={<AdminLayout/>}>
              <Route path="/admin/users" element={<AdminUsers/>} />
            </Route>
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
