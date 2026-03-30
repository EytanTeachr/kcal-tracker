import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { lookupBarcode } from '../utils/openfoodfacts';

export default function BarcodeScanner({ onAdd, onClose }) {
  const [scanning, setScanning] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('100');
  const [useServing, setUseServing] = useState(false);
  const scannerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;

    let html5QrCode = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode('barcode-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // Stop scanner on successful scan
            try {
              await html5QrCode.stop();
            } catch {}
            scannerRef.current = null;
            setScanning(false);
            handleBarcode(decodedText);
          },
          () => {} // ignore scan failures
        );
      } catch (err) {
        setError("Impossible d'accéder à la caméra. Vérifie les permissions.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning]);

  const handleBarcode = async (barcode) => {
    setLoading(true);
    setError(null);
    try {
      const result = await lookupBarcode(barcode);
      setProduct(result);
      if (result.kcalPerServing && result.servingSize) {
        setUseServing(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!product) return;

    let kcal;
    let description;

    if (useServing && product.kcalPerServing) {
      kcal = Math.round(product.kcalPerServing);
      description = `${product.name}${product.brand ? ` (${product.brand})` : ''} - 1 portion (${product.servingSize})`;
    } else {
      const grams = parseInt(quantity, 10) || 100;
      kcal = Math.round((product.kcalPer100g * grams) / 100);
      description = `${product.name}${product.brand ? ` (${product.brand})` : ''} - ${grams}g`;
    }

    onAdd({
      description,
      kcal,
      detail: `Scanné via code-barres (${product.barcode})`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleRescan = () => {
    setProduct(null);
    setError(null);
    setScanning(true);
  };

  return (
    <div className="barcode-scanner">
      <div className="chat-header">
        <button className="btn-back" onClick={onClose}>← Retour</button>
        <span>📷 Scanner un code-barres</span>
      </div>

      {scanning && (
        <div className="scanner-container">
          <div id="barcode-reader" ref={containerRef} />
          <p className="scanner-hint">Place le code-barres dans le cadre</p>
        </div>
      )}

      {loading && (
        <div className="scanner-loading">
          <div className="spinner" />
          <p>Recherche du produit...</p>
        </div>
      )}

      {error && (
        <div className="scanner-error">
          <p>{error}</p>
          <button className="btn-primary" onClick={handleRescan}>
            Réessayer
          </button>
        </div>
      )}

      {product && (
        <div className="product-card">
          {product.image && (
            <img src={product.image} alt={product.name} className="product-image" />
          )}
          <div className="product-info">
            <h3>{product.name}</h3>
            {product.brand && <p className="product-brand">{product.brand}</p>}

            {product.kcalPer100g != null && (
              <div className="product-nutrition">
                <span className="nutrition-value">{product.kcalPer100g} kcal / 100g</span>
                {product.kcalPerServing && product.servingSize && (
                  <span className="nutrition-serving">
                    {product.kcalPerServing} kcal / portion ({product.servingSize})
                  </span>
                )}
              </div>
            )}

            {product.kcalPer100g == null && (
              <p className="scanner-error-text">
                Données nutritionnelles non disponibles pour ce produit.
              </p>
            )}

            {product.kcalPer100g != null && (
              <div className="quantity-selector">
                {product.kcalPerServing && product.servingSize && (
                  <div className="serving-toggle">
                    <button
                      className={`toggle-btn ${!useServing ? 'active' : ''}`}
                      onClick={() => setUseServing(false)}
                    >
                      Par grammes
                    </button>
                    <button
                      className={`toggle-btn ${useServing ? 'active' : ''}`}
                      onClick={() => setUseServing(true)}
                    >
                      Par portion
                    </button>
                  </div>
                )}

                {!useServing ? (
                  <div className="grams-input">
                    <label>Quantité (g) :</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                    />
                    <span className="calc-kcal">
                      = {Math.round((product.kcalPer100g * (parseInt(quantity, 10) || 0)) / 100)} kcal
                    </span>
                  </div>
                ) : (
                  <div className="serving-info">
                    <span>1 portion ({product.servingSize}) = {product.kcalPerServing} kcal</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="product-actions">
            {product.kcalPer100g != null && (
              <button className="btn-primary" onClick={handleAdd}>
                Ajouter au repas
              </button>
            )}
            <button className="btn-secondary" onClick={handleRescan}>
              Scanner un autre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
