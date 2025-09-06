import { useEffect } from 'react';
import Lottie from 'lottie-react';
import animationData from '../assets/notify-lottie.json';

function NotificationToast({ message, onClick, onClose, timeout = 6000 }) {
  useEffect(() => {
    if (!timeout) return;
    const t = setTimeout(() => { onClose?.(); }, timeout);
    return () => clearTimeout(t);
  }, [timeout, onClose]);

  if (!message) return null;

  return (
    <div className="wa-lottie-toast" onClick={onClick} role="alert" aria-live="polite">
      <div className="wa-lottie-icon">
        <Lottie animationData={animationData} loop={true} />
      </div>
      <div className="wa-lottie-content">
        <div className="wa-lottie-title">New message</div>
        <div className="wa-lottie-text"><strong>{message.name}</strong>: {message.text}</div>
      </div>
      <button className="wa-lottie-close" onClick={(e)=>{ e.stopPropagation(); onClose?.(); }} aria-label="Close notification">×</button>
    </div>
  );
}

export default NotificationToast;
