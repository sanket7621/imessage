import React from 'react'
import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage";
import { Navigate, Route, Routes } from "react-router";
import { WallpaperProvider } from "./context/WallpaperContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./App.css";
import { SignedIn, SignedOut, SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/clerk-react'
import { BrowserRouter, Navigate, Route, Router, Routes } from 'react-router';

function App() {


  const { issignedIn, isloaded} = useAuth();
  return (

    
    <Themeprovider>
      <Wallpaperprovider>
       <BrowserRouter>
       
       <Routes>
         <Route path="/" element={isSignedIn ? <ChatPage /> : <Navigate to={"/auth"} replace />} />
        <Route path='/frontend/pages/Authpage.jsx' element = {<Authpage/>}/>
       </Routes>

       
       </BrowserRouter>
      </Wallpaperprovider>
      
    </Themeprovider>
  )
}

export default App
