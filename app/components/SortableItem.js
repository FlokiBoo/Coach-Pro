'use client'

import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Liste réordonnable par glisser-déposer (appui maintenu ~250ms puis glisser), en complément des
// flèches ▲▼ déjà en place partout dans l'app — ne remplace jamais les flèches, s'y ajoute.
// `ids` : liste des identifiants (mêmes clés que les items rendus). `onReorder(id, dir)` : appelé
// une fois par cran franchi pendant le glisser, avec le MÊME contrat que les flèches existantes
// (dir = -1 | 1) — pour rester garanti cohérent avec la logique de déplacement déjà en place.
export function SortableGroup({ ids, onReorder, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const dir = newIndex > oldIndex ? 1 : -1
    for (let i = 0; i < Math.abs(newIndex - oldIndex); i++) onReorder(active.id, dir)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// À placer autour du contenu existant d'une ligne réordonnable, inchangé — expose la poignée de
// glisser via un render-prop (children en fonction) pour l'attacher précisément à une petite icône
// dédiée, sans jamais rendre toute la ligne "draggable" (les boutons/inputs à l'intérieur restent
// utilisables normalement).
export function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  )
}

// Petite poignée "⠿" à coller à côté des flèches ▲▼ existantes — maintenir dessus ~250ms puis
// glisser verticalement pour réordonner à la main.
export function DragHandle({ dragProps }) {
  return (
    <span
      {...(dragProps?.attributes || {})}
      {...(dragProps?.listeners || {})}
      style={{
        cursor: 'grab', touchAction: 'none', fontSize: 14, color: 'var(--text3)',
        padding: '2px 3px', lineHeight: 1, userSelect: 'none', flexShrink: 0,
      }}
      title="Maintenir puis glisser pour déplacer"
    >
      ⠿
    </span>
  )
}
