import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Settings,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

import { supplierService } from '@/services/supplierService';
import {
  SupplierSummary,
  SupplierProduct,
  ImportFilter,
  SupplierCategory
} from '@/types/supplier';
import { Button } from '@/components/ui/button';


const Imports: React.FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [filters, setFilters] = useState<ImportFilter>({
    search: '',
    minPrice: undefined,
    maxPrice: undefined,
    minStock: undefined,
    category: undefined,
    page: 1,
    limit: 20
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const fetchedSuppliers = await supplierService.getSupplierSummaries();
      setSuppliers(fetchedSuppliers);
      
      // If there are suppliers, select the first one
      if (fetchedSuppliers.length > 0) {
        setSelectedSupplier(fetchedSuppliers[0]);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!selectedSupplier) return;
    
    try {
      setProductLoading(true);
      const fetchedProducts = await supplierService.getProducts(selectedSupplier.id, filters);
      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setProductLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!selectedSupplier) return;
    try {
      const fetchedCategories = await supplierService.getCategories(selectedSupplier.id);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    if (selectedSupplier) {
      fetchCategories();
      fetchProducts();
    }
  }, [selectedSupplier]);

  useEffect(() => {
    if (selectedSupplier) {
      fetchProducts();
    }
  }, [filters]);

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await supplierService.deleteSupplier(id);
      setSuppliers(suppliers.filter(s => s.id !== id));
      
      if (selectedSupplier?.id === id) {
        setSelectedSupplier(suppliers.length > 1 ? suppliers.find(s => s.id !== id)! : null);
      }
      
      toast.success('Supplier deleted successfully');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleImportToShopify = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product to import');
      return;
    }
    
    try {
      setImportLoading(true);
      
      // Get the selected products
      const productsToImport = products.filter(p => selectedProducts.includes(p.id));
      
      // Import to Shopify
      const result = await supplierService.importToShopify(productsToImport);
      
      if (result.success) {
        toast.success(`Successfully imported ${result.importedCount} products to Shopify`);
        setSelectedProducts([]);
      } else {
        toast.error(`Failed to import products: ${result.message}`);
      }
    } catch (error) {
      console.error('Error importing products to Shopify:', error);
      toast.error('Failed to import products to Shopify');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFromSupplier = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product to import');
      return;
    }
    
    if (!selectedSupplier) {
      toast.error('No supplier selected');
      return;
    }
    
    try {
      setImportLoading(true);
      
      // Get the external IDs of the selected products
      const productIds = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => p.externalId);
      
      // Import from supplier
      const result = await supplierService.importProducts(selectedSupplier.id, productIds);
      
      if (result.success) {
        toast.success(`Successfully imported ${result.importedCount} products from ${selectedSupplier.name}`);
        setSelectedProducts([]);
      } else {
        toast.error(`Failed to import products: ${result.message}`);
      }
    } catch (error) {
      console.error('Error importing products from supplier:', error);
      toast.error('Failed to import products from supplier');
    } finally {
      setImportLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ImportFilter, value: any) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Supplier Imports</h1>
          <p className="text-gray-600">Import products from external suppliers</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => fetchProducts()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/app/suppliers')}>
            <Plus className="h-4 w-4 mr-2" />
            Open Supplier Hub
          </Button>
        </div>
      </div>
      
      {loading && suppliers.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Supplier sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4">Suppliers</h2>

                {suppliers.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No suppliers yet</h3>
                    <p className="text-gray-500 mb-4">
                      Connect your first supplier in Supplier Hub to start importing products
                    </p>
                    <Button onClick={() => navigate('/app/suppliers')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Open Supplier Hub
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSupplier?.id === supplier.id
                            ? 'border-primary bg-primary-50'
                            : 'border-gray-200 hover:border-primary-200'
                        }`}
                        onClick={() => setSelectedSupplier(supplier)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{supplier.name}</h3>
                            <div className="flex items-center mt-1">
                              <span className="text-xs text-gray-500 capitalize">{supplier.type}</span>
                              <span className="mx-2 text-gray-300">•</span>
                              <span className={`text-xs ${
                                supplier.status === 'active' ? 'text-green-600' :
                                supplier.status === 'error' ? 'text-red-600' :
                                'text-gray-500'
                              }`}>
                                {supplier.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSupplier(supplier.id);
                              }}
                              className="text-gray-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSupplier && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Categories</h3>
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">No categories available</p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto">
                      <li
                        className={`cursor-pointer text-sm ${!filters.category ? 'text-primary font-medium' : 'text-gray-700'}`}
                        onClick={() => handleFilterChange('category', undefined)}
                      >
                        All Products
                      </li>
                      {categories.map((cat) => (
                        <li
                          key={cat.id}
                          className={`cursor-pointer text-sm ${filters.category === cat.externalId ? 'text-primary font-medium' : 'text-gray-700'}`}
                          onClick={() => handleFilterChange('category', cat.externalId)}
                        >
                          {cat.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Main content */}
          <div className="md:col-span-3">
            {selectedSupplier ? (
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-lg font-medium">{selectedSupplier.name}</h2>
                      <p className="text-sm text-gray-500 capitalize">{selectedSupplier.type} Integration</p>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
                        selectedSupplier.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedSupplier.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedSupplier.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {selectedSupplier.status === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {selectedSupplier.status.charAt(0).toUpperCase() + selectedSupplier.status.slice(1)}
                      </span>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search products..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                          value={filters.search || ''}
                          onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                      </div>
                      <Button type="submit">
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </form>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFilterChange('page', Math.max(1, (filters.page || 1) - 1))}
                        disabled={(filters.page || 1) <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFilterChange('page', (filters.page || 1) + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="select-all"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        onChange={handleSelectAll}
                        checked={selectedProducts.length > 0 && selectedProducts.length === products.length}
                      />
                      <label htmlFor="select-all" className="ml-2 text-sm text-gray-700">
                        Select All
                      </label>
                    </div>
                    
                    {selectedProducts.length > 0 && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={handleImportFromSupplier}
                          disabled
                          title="Import désactivé tant que le pipeline canonique n'accepte pas les snapshots fournisseurs vérifiés"
                        >
                          {importLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Import pipeline à connecter
                        </Button>
                        <Button onClick={handleImportToShopify} disabled={importLoading}>
                          {importLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Import to Shopify
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {productLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">No products found</h3>
                      <p className="text-gray-500 mb-4">
                        Try adjusting your search or filters
                      </p>
                      <Button onClick={() => setFilters({
                        search: '',
                        minPrice: undefined,
                        maxPrice: undefined,
                        minStock: undefined,
                        category: undefined,
                        page: 1,
                        limit: 20
                      })}>
                        Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className={`border rounded-lg overflow-hidden ${
                            selectedProducts.includes(product.id)
                              ? 'border-primary ring-1 ring-primary'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="relative h-48 bg-gray-100">
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="h-12 w-12 text-gray-300" />
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              <Button
                                size="icon"
                                variant="secondary"
                                onClick={() => handleProductSelect(product.id)}
                              >
                                {selectedProducts.includes(product.id) ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                            
                            <div className="mt-2 flex justify-between">
                              <div>
                                <p className="text-lg font-bold text-primary">
                                  {product.metadata?.priceVerified === false
                                    ? 'Prix non vérifié'
                                    : `${product.price.toFixed(2)}`}
                                </p>
                                {product.msrp && product.msrp > product.price && (
                                  <p className="text-sm text-gray-500 line-through">${product.msrp.toFixed(2)}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-600">
                                  Stock: {product.metadata?.stockVerified === false ? 'Non vérifié' : product.stock}
                                </p>
                                {product.sku && (
                                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <Button
                                variant={selectedProducts.includes(product.id) ? "default" : "outline"}
                                className="w-full"
                                onClick={() => handleProductSelect(product.id)}
                              >
                                {selectedProducts.includes(product.id) ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Selected
                                  </>
                                ) : (
                                  <>
                                    Select
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {products.length > 0 && (
                    <div className="mt-6 flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        Showing {products.length} products
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFilterChange('page', Math.max(1, (filters.page || 1) - 1))}
                          disabled={(filters.page || 1) <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFilterChange('page', (filters.page || 1) + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-lg shadow-sm text-center">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No supplier selected</h3>
                <p className="text-gray-500 mb-4">
                  {suppliers.length === 0
                    ? 'Connect your first supplier in Supplier Hub to start importing products'
                    : 'Select a supplier from the list to view and import products'}
                </p>
                <Button onClick={() => navigate('/app/suppliers')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Open Supplier Hub
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Imports;