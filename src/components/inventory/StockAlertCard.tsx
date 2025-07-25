import React, { useState } from 'react';
import { AlertTriangle, XCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StockAlert } from '@/types/utils';
import { StockSparkline } from '@/components/ui/stock-sparkline';

export const StockAlertCard = ({
  alert,
  onIgnore,
  onResolve,
}: {
  alert: StockAlert;
  onIgnore: (id: string) => void;
  onResolve: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'critique':
        return 'bg-red-100 text-red-700';
      case 'moyenne':
        return 'bg-yellow-100 text-yellow-700';
      case 'basse':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="border border-red-200 bg-red-50 rounded-lg p-4 shadow-sm hover:shadow-md cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start">
          <img
            src={alert.productImage || '/placeholder.png'}
            alt={alert.productName}
            className="w-16 h-16 object-cover rounded-md border mr-4"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{alert.productName}</h4>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${getLevelBadgeColor(alert.level || 'critique')}`}
              >
                {alert.level || 'critique'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Stock actuel :{' '}
              <span className="font-medium text-red-600">{alert.currentStock}</span>{' '}
              (seuil : {alert.threshold})
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Stock critique détecté – ajustez ou réapprovisionnez rapidement.
            </p>
          </div>
        </div>
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIgnore(alert.id!);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Ignorer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ignorer l'alerte</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve(alert.id!);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Résolu
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marquer comme résolu</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 text-sm text-gray-700 bg-white rounded-md border p-4"
          >
            <p><strong>Dernier réassort :</strong> {alert.lastRestock || '18/07/2025'}</p>
            <p><strong>Fournisseur :</strong> {alert.supplier || 'BigBuy'}</p>
            <p><strong>SKU :</strong> {alert.sku || 'Non renseigné'}</p>
            <p><strong>Actions suggérées :</strong> Réapprovisionnement + ajustement prix automatique.</p>

            {alert.history && (
              <div className="mt-4">
                <small className="text-xs text-gray-500">Évolution du stock</small>
                <StockSparkline data={alert.history} />
              </div>
            )}

            {alert.orderLink && (
              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(alert.orderLink, '_blank');
                  }}
                >
                  Commander chez le fournisseur
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end mt-2">
        <Button
          size="icon"
          variant="ghost"
          className="text-gray-500 hover:text-gray-800"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </div>
    </motion.div>
  );
};
