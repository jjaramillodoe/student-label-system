'use client';

import { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scan, X, Search, Camera } from 'lucide-react';
import { extractStudentIdFromQrPayload } from '@/lib/qrPayload';

interface BarcodeScannerProps {
  onScan: (studentId: string) => void;
  onManualEntry?: (studentId: string) => void;
}

export default function BarcodeScanner({ onScan, onManualEntry }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manualId, setManualId] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (open && scanning) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open, scanning]);

  function startScanning() {
    if (!videoRef.current) return;

    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      codeReader
        .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            const studentId = extractStudentIdFromQrPayload(result.getText());
            stopScanning();
            setOpen(false);
            onScan(studentId);
          }
          if (err && !(err.name === 'NotFoundException')) {
            setError('Scanning error. Please try again.');
          }
        })
        .catch((err) => {
          console.error('Error starting scanner:', err);
          setError('Failed to start camera. Please check permissions.');
          setScanning(false);
        });
    } catch (err) {
      console.error('Error initializing scanner:', err);
      setError('Scanner not available. Please use manual entry.');
      setScanning(false);
    }
  }

  function stopScanning() {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
  }

  function handleManualSearch() {
    if (manualId.trim()) {
      const studentId = extractStudentIdFromQrPayload(manualId);
      if (onManualEntry) {
        onManualEntry(studentId);
      } else {
        onScan(studentId);
      }
      setManualId('');
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Scan className="h-4 w-4" />
        Scan Barcode
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          stopScanning();
          setScanning(false);
          setError('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Barcode Scanner
            </DialogTitle>
            <DialogDescription>
              Scan a student barcode or enter the student ID manually
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Camera View */}
            {scanning ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-md"
                  style={{ objectFit: 'contain' }}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setScanning(false);
                    stopScanning();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-muted rounded-md border-2 border-dashed">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <Button
                  onClick={() => {
                    setError('');
                    setScanning(true);
                  }}
                  className="gap-2"
                >
                  <Scan className="h-4 w-4" />
                  Start Camera
                </Button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Manual Entry */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Or enter Student ID manually:</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Student ID"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleManualSearch();
                    }
                  }}
                />
                <Button onClick={handleManualSearch} disabled={!manualId.trim()}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

