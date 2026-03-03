import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Login from "./pages/auth/Login"
import Signup from "./pages/auth/Signup"
import Pending from "./pages/auth/Pending"
import Dashboard from "./pages/shared/Dashboard"
import { Toaster } from "react-hot-toast"

import RequireActive from "./components/RequireActive"
import RequirePending from "./components/RequirePending"
import EmployeeLayout from "./layouts/EmployeeLayout"
import RequireAdmin from "./components/RequireAdmin"
import AdminLayout from "./layouts/AdminLayout"
import AdminUsers from "./pages/admin/AdminUsers"
import Clients from "./components/clients/Clients"
import Inventory from "./pages/shared/Inventory"
import Settings from "./pages/admin/Settings"


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
               <Route path="/clients" element= {<Clients/>}/>
               <Route path="/inventory" element={<Inventory/>}/>
            </Route>     
          </Route>
   

          {/* Admin protected area */}
          <Route element={<RequireAdmin/>}>
            <Route element={<AdminLayout/>}>
              <Route path="/admin/dashboard" element={<Dashboard/>}/>
              <Route path="/admin/users" element={<AdminUsers/>} />
              <Route path="/admin/clients" element= {<Clients/>}/>
              <Route path="/admin/inventory" element={<Inventory/>}/>
              <Route path="/admin/settings" element={<Settings/>}/>
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
