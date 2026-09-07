import { useState, type DragEvent } from "react";

export interface DragHandlers {
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

/** Native HTML5 drag-and-drop reordering: dragstart captures the source
 * index, dragover must preventDefault to allow a drop, drop invokes the
 * reorder callback, dragend always clears the pending drag state. */
export function useDragReorder(onReorder: (fromIndex: number, toIndex: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function getHandlers(index: number): DragHandlers {
    return {
      draggable: true,
      onDragStart: () => setDragIndex(index),
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: () => {
        if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
      },
      onDragEnd: () => setDragIndex(null),
    };
  }

  return { dragIndex, getHandlers };
}
