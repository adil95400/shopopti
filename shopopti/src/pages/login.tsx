import { useState } from 'react'
import { signInWithEmail } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    try {
      await signInWithEmail(email)
      setMessage('Lien de connexion envoyé à votre adresse email.')
    } catch (err) {
      setMessage('Erreur de connexion.')
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Connexion Shopopti+</h1>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="border p-2 w-full mb-2"
        placeholder="Entrez votre email"
      />
      <button onClick={handleLogin} className="bg-blue-500 text-white px-4 py-2 rounded">
        Se connecter
      </button>
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}
