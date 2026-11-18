import { ChevronRight, Folder, FolderOpen, Package } from 'lucide-react'
import { expiredPolicyLabel, taxRateLabel } from '../inventoryOptions'
import './CategoryPreview.css'

/** Ruta de la categoría y lo que heredarán sus productos. */
export function CategoryPreview({ parentName, name, defaultTaxRate, expiredSalePolicy }) {
  const label = name.trim() || (parentName ? 'Subcategoría' : 'Categoría')
  return (
    <div className="category-preview">
      <div className="category-preview__path">
        {parentName && (
          <>
            <span className="category-preview__crumb">
              <Folder aria-hidden="true" /> {parentName}
            </span>
            <ChevronRight className="category-preview__separator" aria-hidden="true" />
          </>
        )}
        <span className="category-preview__crumb category-preview__crumb--current">
          <FolderOpen aria-hidden="true" /> {label}
        </span>
      </div>
      <div className="category-preview__product">
        <span className="category-preview__product-icon" aria-hidden="true">
          <Package />
        </span>
        <div>
          <p className="category-preview__product-name">Un producto nuevo aquí</p>
          <p className="category-preview__product-detail">{taxRateLabel(defaultTaxRate)}</p>
          <p className="category-preview__product-detail">{expiredPolicyLabel(expiredSalePolicy)}</p>
        </div>
      </div>
    </div>
  )
}
