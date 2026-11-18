import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <StatusMessage
      icon={Compass}
      title="Esta página no existe"
      description="Puede que la dirección esté mal escrita o que el módulo aún no esté disponible."
    >
      <Button icon={ArrowLeft} onClick={() => navigate('/')}>
        Volver al inicio
      </Button>
    </StatusMessage>
  )
}
