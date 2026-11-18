import { Spinner } from '../../ui/Spinner/Spinner'
import { NexoonCredit } from '../../brand/NexoonCredit/NexoonCredit'
import emblem from '../../../assets/brand/nexsupply-emblem.jpg'
import './LoadingScreen.css'

/** Pantalla de carga completa (arranque de la app, cambio de sesión). */
export function LoadingScreen({ message = 'Cargando NexSupply…' }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen__body">
        <img className="loading-screen__emblem" src={emblem} alt="NexSupply" width="180" height="120" />
        <Spinner size="lg" label={message} />
        <p className="loading-screen__message" aria-hidden="true">
          {message}
        </p>
      </div>
      <NexoonCredit />
    </div>
  )
}
