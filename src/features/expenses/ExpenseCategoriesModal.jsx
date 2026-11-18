import { useState } from 'react'
import { Check, FolderCog, Pencil, Plus, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Switch } from '../../components/ui/Switch/Switch'
import { TextField } from '../../components/ui/TextField/TextField'
import { Alert } from '../../components/feedback/Alert/Alert'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { splitApiError } from '../../utils/formErrors'
import { useCreateExpenseCategoryMutation, useGetExpenseCategoriesQuery, useUpdateExpenseCategoryMutation } from './expensesApi'
import { categoryTone } from './expenseOptions'
import './expenses.css'

/** Categorías de gastos (D-GAS-5): crear, renombrar y activar o desactivar. No se borran. */
export function ExpenseCategoriesModal({ onClose }) {
  const toast = useToast()
  const { data: categories = [] } = useGetExpenseCategoriesQuery({ includeInactive: 'true' })
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null) // { id, name }
  const [createCategory, createState] = useCreateExpenseCategoryMutation()
  const [updateCategory, updateState] = useUpdateExpenseCategoryMutation()
  const { fieldErrors, formError } = splitApiError(createState.error ?? updateState.error)

  const handleCreate = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) return
    try {
      const created = await createCategory({ name: name.trim() }).unwrap()
      toast.success(`Categoría "${created.name}" creada`)
      setName('')
    } catch {
      // Se muestra abajo
    }
  }

  const save = async (changes) => {
    try {
      await updateCategory(changes).unwrap()
      setEditing(null)
    } catch {
      // Se muestra abajo
    }
  }

  return (
    <Modal isOpen onClose={onClose} icon={FolderCog} title="Categorías de gastos" description="Las categorías desactivadas no aparecen al registrar, pero sus gastos se conservan." footer={<Button onClick={onClose}>Listo</Button>}>
      {formError && (
        <div className="admin-form__alert">
          <Alert tone="danger">{formError}</Alert>
        </div>
      )}
      <form className="expense-category-new" onSubmit={handleCreate} noValidate>
        <TextField label="Nueva categoría" placeholder="Ej.: Publicidad" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} error={fieldErrors.name} />
        <Button type="submit" icon={Plus} isLoading={createState.isLoading} disabled={name.trim().length < 2}>
          Agregar
        </Button>
      </form>
      <ul className="expense-categories">
        {categories.map((category) => (
          <li key={category.id} className={category.isActive ? undefined : 'is-inactive'}>
            {editing?.id === category.id ? (
              <form
                className="expense-categories__edit"
                onSubmit={(event) => {
                  event.preventDefault()
                  save({ id: category.id, name: editing.name.trim() })
                }}
              >
                <input aria-label={`Nuevo nombre de ${category.name}`} value={editing.name} maxLength={80} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                <IconButton icon={Check} label="Guardar el nombre" type="submit" />
                <IconButton icon={X} label="Cancelar" onClick={() => setEditing(null)} />
              </form>
            ) : (
              <>
                <span className={`expense-chip tone-${categoryTone(category.id)}`}>{category.name}</span>
                <IconButton icon={Pencil} label={`Renombrar ${category.name}`} onClick={() => setEditing({ id: category.id, name: category.name })} />
                <Switch label={category.isActive ? 'Activa' : 'Inactiva'} checked={category.isActive} onChange={(checked) => save({ id: category.id, isActive: checked })} />
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
