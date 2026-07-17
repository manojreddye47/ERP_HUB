import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerId = "qr-reader-container";

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      try {
        scannerRef.current = new Html5QrcodeScanner(
          containerId,
          { 
            fps: 10, 
            qrbox: (width, height) => ({
              width: Math.min(width * 0.8, 300),
              height: Math.min(height * 0.5, 150)
            }),
            aspectRatio: 1.0,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.UPC_A
            ]
          },
          false
        );

        scannerRef.current.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            if (scannerRef.current) {
              scannerRef.current.clear().catch(err => console.error(err));
            }
            onClose();
          },
          () => {
            // Swallow continuous scanning frame read failures
          }
        );
      } catch (err) {
        console.error("Failed to initialize QR scanner:", err);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Scanner clear failed on unmount:", err));
      }
    };
  }, [isOpen, onClose, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <div style={modalHeaderStyle}>
          <h3>Scan QR Code</h3>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px 0' }}>
          <div id={containerId} style={{ width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px' }}></div>
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
            Point your camera at a stock item QR code. It will automatically process the item.
          </p>
        </div>
      </div>
    </div>
  );
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  backdropFilter: 'blur(4px)'
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '24px',
  width: '100%',
  maxWidth: '480px',
  boxShadow: 'var(--shadow-lg)'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '12px'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center'
};
export default QRScannerModal;
