
import type { RouteEditor } from '../hooks/useRouteEditor'
import type { MapRoute } from '../types'

type Props = {
  routes: MapRoute[]
  editor: RouteEditor
  onDelete: (route: MapRoute) => void
}

export default function RoutesPanel({ routes, editor, onDelete }: Props) {
  const canSave =
    editor.hasRoute &&
    !editor.busy &&
    !editor.saving &&
    editor.name.trim() !== '' &&
    editor.fare !== '' &&
    Number(editor.fare) >= 0 &&
    editor.startPoint.trim() !== '' &&
    editor.endPoint.trim() !== ''

  return (
    <aside className="routes-editor-side">
      {!editor.editing ? (
        <>
          <button type="button" onClick={editor.startNew}>
            + إضافة خط جديد
          </button>

          {routes.map((r) => (
            <div key={r.id} className="route-item">
              <span
                className="route-color"
                style={{ backgroundColor: r.color }}
              />

              <span>
                {r.route_name}
                {' — '}
                {r.direction}
              </span>

              <button type="button" onClick={() => editor.startEdit(r)}>
                تعديل
              </button>
              
              {!routes.some(
                (other) =>
                  other.bus_id === r.bus_id &&
                  other.direction !== r.direction,
              ) && (
                <button
                  type="button"
                  onClick={() =>
                    editor.startAddDirection(
                      r,
                      r.direction === 'ذهاب' ? 'إياب' : 'ذهاب',
                    )
                  }
                >
                  + إضافة الاتجاه الآخر
                </button>
              )}

              <button type="button" onClick={() => onDelete(r)}>
                حذف
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          <h3>
            {editor.editingId !== null
              ? 'تعديل المسار'
              : editor.addingToBusId !== null
                ? 'إضافة اتجاه لباص موجود'
            : 'باص جديد'}
          </h3>

          <label>
            اسم الباص
            <input
              type="text"
              value={editor.name}
              disabled={editor.addingToBusId !== null}
              placeholder="مثال: باص 19"
              onChange={(e) => editor.setName(e.target.value)}
            />
          </label>

          <label>
            اللون
            <input
              type="color"
              value={editor.color}
              disabled={editor.addingToBusId !== null}
              onChange={(e) => editor.setColor(e.target.value)}
            />
          </label>

          <label>
            الأجرة
            <input
              type="number"
              min="0"
              value={editor.fare}
              disabled={editor.addingToBusId !== null}
              placeholder="مثال: 500"
              onChange={(e) => editor.setFare(e.target.value)}
            />
          </label>

          <label>
            الاتجاه
            <select
              value={editor.direction}
              disabled={
                editor.editingId !== null ||
                editor.addingToBusId !== null
              }
              onChange={(e) =>
                editor.setDirection(e.target.value as 'ذهاب' | 'إياب')
              }
            >
              <option value="ذهاب">ذهاب</option>
              <option value="إياب">إياب</option>
            </select>
          </label>

          <label>
            نقطة الانطلاق
            <input
              type="text"
              value={editor.startPoint}
              placeholder="أدخل اسم نقطة الانطلاق"
              onChange={(e) => editor.setStartPoint(e.target.value)}
            />
          </label>

          <label>
            نقطة الوصول
            <input
              type="text"
              value={editor.endPoint}
              placeholder="أدخل اسم نقطة الوصول"
              onChange={(e) => editor.setEndPoint(e.target.value)}
            />
          </label>

          <p className="routes-editor-hint">
            حدد نقاط المسار على الخريطة. يمكنك سحب النقاط لتعديلها أو الضغط
            على الخط لإضافة نقطة وسيطة.
          </p>

          <p>عدد النقاط: {editor.count}</p>

          {editor.busy && <small>جاري حساب المسار…</small>}

          <button
            type="button"
            onClick={editor.undo}
            disabled={editor.count === 0 || editor.saving}
          >
            تراجع
          </button>

          <button
            type="button"
            onClick={editor.save}
            disabled={!canSave}
          >
            {editor.saving ? 'جاري الحفظ…' : 'حفظ'}
          </button>

          <button
            type="button"
            onClick={editor.cancel}
            disabled={editor.saving}
          >
            إلغاء
          </button>
        </>
      )}

      {editor.error && (
        <small className="routes-editor-error">{editor.error}</small>
      )}
    </aside>
  )
}
