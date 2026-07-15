/**
 * 轻提示消息系统
 * @author xiangwei
 */

let container: HTMLDivElement | null = null
let idCounter = 0

type ToastType = 'success' | 'warning' | 'error' | 'info'

function getContainer(): HTMLDivElement {
    if (!container) {
        container = document.createElement('div')
        container.className = 'bb-toast-container'
        container.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 9999; display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    `
        document.body.appendChild(container)
    }
    return container
}

function show(text: string, type: ToastType = 'info', duration = 2500): void {
    const c = getContainer()
    const id = ++idCounter
    const el = document.createElement('div')
    el.id = `toast-${id}`
    el.style.cssText = `
    pointer-events: auto; padding: 10px 20px; border-radius: 8px;
    font-size: 14px; font-weight: 500; line-height: 1.5;
    background: #fff; border: 1px solid #e2e8f0; color: #0f172a;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    animation: toast-in 0.25s ease; white-space: nowrap;
    display: flex; align-items: center; gap: 8px;
  `
    const colors: Record<string, string> = {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    }
    const dot = document.createElement('span')
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${colors[type]};flex-shrink:0`
    el.prepend(dot)
    el.appendChild(document.createTextNode(text))
    c.appendChild(el)

    setTimeout(() => {
        el.style.animation = 'toast-out 0.2s ease forwards'
        setTimeout(() => el.remove(), 200)
    }, duration)
}

/** 注入全局动画 keyframes */
const style = document.createElement('style')
style.textContent = `
  @keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-8px); } }
`
document.head.appendChild(style)

export const Message = {
    success: (text: string) => show(text, 'success'),
    warning: (text: string) => show(text, 'warning'),
    error: (text: string) => show(text, 'error'),
    info: (text: string) => show(text, 'info')
}
