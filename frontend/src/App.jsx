import React from 'react'
import "./App.css";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react'


function App() {


  const { issignedIn, isloaded} = useAuth();
  return (
    
     <div>
      <h1> App</h1>

      <header>
        <SignedOut>
          <SignInButton />
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>


     </div>
    
    
  )
}

export default App