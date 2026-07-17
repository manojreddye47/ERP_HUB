import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

interface AlwaysOnScannerProps {
  active: boolean;
  onScanSuccess: (decodedText: string) => void;
  pausedMessage?: string;
}

export const AlwaysOnScanner: React.FC<AlwaysOnScannerProps> = ({ active, onScanSuccess, pausedMessage }) => {
  const containerId = "always-on-camera-view";
  const html5QrcodeRef = useRef<any | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [inCooldown, setInCooldown] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let scannerStarted = false;
    let isCooldown = false;

    const startCamera = async () => {
      if (!active) return;
      setIsInitializing(true);
      setHasError(false);
      setIsLive(false);

      // Wait briefly for element mounting
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!isMounted) return;

      try {
        const formats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ];

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: formats,
          verbose: false
        });
        html5QrcodeRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            if (isMounted && !isCooldown) {
              isCooldown = true;
              setInCooldown(true);
              
              onScanSuccess(decodedText);
              
              // Lock scanning for exactly 1.5 seconds to prevent double scanning
              setTimeout(() => {
                isCooldown = false;
                if (isMounted) {
                  setInCooldown(false);
                }
              }, 1500);
            }
          },
          () => {
            // Frame read failure
          }
        );
        
        scannerStarted = true;
        if (isMounted) {
          setIsInitializing(false);
          setIsLive(true);
        }
      } catch (err) {
        console.warn("Always-on camera initialize failed:", err);
        if (isMounted) {
          setHasError(true);
          setIsInitializing(false);
          setIsLive(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      setIsLive(false);
      const scanner = html5QrcodeRef.current;
      if (scanner && scannerStarted) {
        scanner.stop()
          .catch((err: any) => console.warn("Failed to stop always-on scanner:", err))
          .finally(() => {
            html5QrcodeRef.current = null;
          });
      }
    };
  }, [active, onScanSuccess]);

  return (
    <div style={scannerContainerStyle}>
      {/* Constrain any video & canvas injected by html5-qrcode strictly inside viewport */}
      <style>{`
        #${containerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 1 !important;
        }
        #${containerId} canvas {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 2 !important;
        }
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>

      {/* Parent wrapper coordinates container */}
      <div style={cameraViewportStyle}>
        
        {/* Dedicated camera target div (strictly empty to isolate from React reconciliation) */}
        <div id={containerId} style={cameraTargetStyle}></div>

        {/* React-controlled overlays are siblings (never inside containerId) */}
        {!active && (
          <div style={overlayMessageStyle}>
            <CameraOff size={24} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 16px' }}>
              {pausedMessage || 'Camera paused'}
            </span>
          </div>
        )}
        {active && isInitializing && (
          <div style={overlayMessageStyle}>
            <Camera size={24} className="spin" style={{ marginBottom: '8px', color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Waking camera feed...</span>
          </div>
        )}
        {active && hasError && (
          <div style={overlayMessageStyle}>
            <CameraOff size={24} style={{ marginBottom: '8px', color: 'var(--danger)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '200px' }}>
              Camera feed failed. Grant permission or verify hardware.
            </span>
          </div>
        )}

        {/* Cooldown Lock Screen Overlay */}
        {active && isLive && inCooldown && (
          <div style={cooldownOverlayStyle}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--success)' }}>✓ Logged</span>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>Locking duplicate reads...</span>
          </div>
        )}

        {/* Custom CSS Laser Reticle Overlay */}
        {active && isLive && !inCooldown && (
          <div style={reticleOverlayStyle}>
            <div style={reticleBoxStyle}>
              {/* Corner borders */}
              <div style={{ ...cornerStyle, top: '-2px', left: '-2px', borderWidth: '2px 0 0 2px' }} />
              <div style={{ ...cornerStyle, top: '-2px', right: '-2px', borderWidth: '2px 2px 0 0' }} />
              <div style={{ ...cornerStyle, bottom: '-2px', left: '-2px', borderWidth: '0 0 2px 2px' }} />
              <div style={{ ...cornerStyle, bottom: '-2px', right: '-2px', borderWidth: '0 2px 2px 0' }} />
              {/* Laser line */}
              <div style={scanningLaserStyle} />
            </div>
          </div>
        )}
      </div>
      <div style={helperTextStyle}>
        <div style={reticleIndicatorStyle} />
        <span>Align QR code or horizontal barcode inside the box</span>
      </div>
    </div>
  );
};

const scannerContainerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const cameraViewportStyle: React.CSSProperties = {
  width: '100%',
  height: '240px',
  backgroundColor: '#0c0c0e',
  borderRadius: '8px',
  overflow: 'hidden',
  position: 'relative',
  border: '1px solid var(--border-color)',
  boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.8)'
};

const cameraTargetStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1
};

const overlayMessageStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(18, 18, 20, 0.9)',
  zIndex: 5,
  fontFamily: 'var(--font-body)'
};

const cooldownOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  backdropFilter: 'blur(3px)',
  zIndex: 4,
  fontFamily: 'var(--font-body)'
};

const reticleOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 3
};

const reticleBoxStyle: React.CSSProperties = {
  width: '200px',
  height: '200px',
  position: 'relative',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  boxShadow: '0 0 20px rgba(92, 107, 192, 0.2)'
};

const cornerStyle: React.CSSProperties = {
  position: 'absolute',
  width: '16px',
  height: '16px',
  borderColor: 'var(--accent-primary)',
  borderStyle: 'solid'
};

const scanningLaserStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  width: '100%',
  height: '2px',
  backgroundColor: 'var(--danger)',
  boxShadow: '0 0 10px var(--danger)',
  animation: 'scan-laser 2s linear infinite'
};

const helperTextStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '11px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)'
};

const reticleIndicatorStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: 'var(--accent-primary)',
  boxShadow: '0 0 8px var(--accent-primary)'
};

export default AlwaysOnScanner;
