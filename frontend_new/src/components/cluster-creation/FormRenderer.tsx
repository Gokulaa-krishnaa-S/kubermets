import React, { useState, useEffect } from 'react';
import { Upload, X, Plus, Trash2, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Tooltip component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <div className="relative group inline-block">
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
      {content}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string; when?: string; options?: Array<{ value: string; label: string }> }>;
  fields?: FormField[];
  showIf?: Record<string, any>;
  validation?: { type: string };
  itemType?: string;
  poolType?: string;
  description?: string;
  optional?: boolean;
  dependsOn?: string; // Field that this field depends on
}

interface FormTemplate {
  title: string;
  fields: FormField[];
}

interface FormRendererProps {
  template: FormTemplate;
  data: any;
  onChange: (data: any) => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  status?: { type: 'success' | 'error' | null; messages?: string[] };
}

export default function FormRenderer({
  template,
  data,
  onChange,
  onSubmit,
  loading = false,
  submitButtonText = 'Submit',
  onCancel,
  status
}: FormRendererProps) {
  const [formData, setFormData] = useState(data || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<{
    type: 'info' | 'success' | 'error' | null;
    messages: string[];
  }>({ type: null, messages: [] });

  // Set default values on mount
  useEffect(() => {
    const defaultData = { ...data };
    // Set default for networkConfig if not already set
    if (!defaultData.networkConfig) {
      defaultData.networkConfig = 'create-new';
    }
    setFormData(defaultData);
    onChange(defaultData);
  }, []);

  useEffect(() => {
    if (!status || !status.type) return;
    const msgs = status.messages && status.messages.length > 0 ? status.messages : [
      status.type === 'success' ? 'Cluster creation is in progress!' : 'Cluster creation failed'
    ];
    setModal({ type: status.type, messages: msgs });

    // Auto-close modal after 2 seconds for both success and error
    if (status.type === 'success' || status.type === 'error') {
      const t = setTimeout(() => setModal({ type: null, messages: [] }), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    setFormData(data || {});
  }, [data]);

  const updateFormData = (updates: any) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    onChange(newData);
  };

  const shouldShowField = (field: FormField): boolean => {
    if (!field.showIf) return true;

    return Object.entries(field.showIf).every(([key, value]) => {
      return formData[key] === value;
    });
  };

  const validateField = (field: FormField, value: any): string => {
    if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`;
    }

    // Handle file field validation with new structure
    if (field.type === 'file' && field.required && (!value || !value.content)) {
      return `${field.label} is required`;
    }

    if (field.validation?.type === 'cidrBlock' && value) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!cidrRegex.test(value)) {
        return 'Please enter a valid CIDR block (e.g., 10.0.0.0/16)';
      }
    }

    if (field.validation?.type === 'gcpProjectId' && value) {
      const projectIdRegex = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
      if (!projectIdRegex.test(value)) {
        return 'Project ID must be 6-30 characters, start with lowercase letter, and contain only lowercase letters, numbers, and hyphens';
      }
    }

    if (field.validation?.type === 'clusterName' && value) {
      const clusterNameRegex = /^[a-z][a-z0-9-]{0,39}$/;
      if (!clusterNameRegex.test(value)) {
        return 'Cluster name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens (max 40 chars)';
      }
    }

    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all visible required fields
    const newErrors: Record<string, string> = {};

    const validateFields = (fields: FormField[], prefix = '') => {
      fields.forEach(field => {
        if (!shouldShowField(field)) return;

        const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
        const value = prefix ? formData[prefix]?.[field.name] : formData[field.name];

        // Handle dynamic-pool-group validation
        if (field.type === 'dynamic-pool-group') {
          const pools = formData[field.name] || [];
          pools.forEach((pool: any, poolIndex: number) => {
            field.fields?.forEach(poolField => {
              const poolFieldPath = `${field.name}[${poolIndex}].${poolField.name}`;
              const poolFieldValue = pool[poolField.name];

              const poolError = validateField(poolField, poolFieldValue);
              if (poolError) {
                newErrors[poolFieldPath] = poolError;
              }
            });
          });
        } else {
          const error = validateField(field, value);
          if (error) {
            newErrors[fieldPath] = error;
          }

          if (field.fields) {
            validateFields(field.fields, fieldPath);
          }
        }
      });
    };

    validateFields(template.fields);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Show only the first error in field order (FIFO)
      const firstError = Object.values(newErrors)[0];
      setModal({ type: 'info', messages: [firstError] });
      return;
    }

    setErrors({});
    onSubmit(formData);
  };

  const renderField = (field: FormField, prefix = ''): React.ReactNode => {
    if (!shouldShowField(field)) return null;

    const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
    const value = prefix ? formData[prefix]?.[field.name] : formData[field.name];
    const error = errors[fieldPath];

    const updateValue = (newValue: any) => {
      if (prefix) {
        const currentGroup = formData[prefix] || {};
        updateFormData({
          [prefix]: {
            ...currentGroup,
            [field.name]: newValue
          }
        });
      } else {
        updateFormData({ [field.name]: newValue });
      }
    };

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <div key={fieldPath} className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <Input
              type={field.type}
              value={value || ''}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'border-destructive' : ''}
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldPath} className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <Select value={value || ''} onValueChange={updateValue}>
              <SelectTrigger className={error ? 'border-destructive' : ''}>
                <SelectValue placeholder={`Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={fieldPath} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={value || false}
                onCheckedChange={updateValue}
                id={fieldPath}
              />
              <Label htmlFor={fieldPath} className="text-sm font-medium cursor-pointer">
                {field.label}
              </Label>
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground ml-6">{field.helpText}</p>
            )}
          </div>
        );

      case 'checkbox-group':
        return (
          <div key={fieldPath} className="space-y-3">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={(value || []).includes(option.value)}
                    onCheckedChange={(checked) => {
                      const currentValues = value || [];
                      if (checked) {
                        updateValue([...currentValues, option.value]);
                      } else {
                        updateValue(currentValues.filter((v: string) => v !== option.value));
                      }
                    }}
                    id={`${fieldPath}-${option.value}`}
                  />
                  <Label htmlFor={`${fieldPath}-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case 'tab-group':
        return (
          <div key={fieldPath} className="space-y-3">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              {field.options?.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={value === option.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => updateValue(option.value)}
                  className={`flex-1 ${value === option.value
                    ? 'bg-[#9db309] text-white shadow-sm hover:bg-[#8ca208]'
                    : 'hover:bg-background/50'
                    }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case 'file':
        // Collapsible permissions info
        const [showPerms, setShowPerms] = React.useState(false);
        return (
          <div key={fieldPath} className="space-y-2">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const json = JSON.parse(event.target?.result as string);
                        // Store both the JSON content and file name
                        console.log('Parsed JSON:', json);
                        updateValue({
                          content: json,
                          fileName: file.name,
                          fileSize: file.size
                        });
                        // updateValue(json);
                      } catch (error) {
                        console.error('Error parsing JSON file:', error);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
                className="hidden"
                id={fieldPath}
                key={value ? 'file-input-with-value' : 'file-input-empty'}
              />

              {value && value.fileName ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">{value.fileName}</p>
                      <p className="text-xs text-green-600">
                        {(value.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      updateValue(null);
                      // Reset the file input to allow re-uploading the same file
                      const fileInput = document.getElementById(fieldPath) as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = '';
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label htmlFor={fieldPath} className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload JSON file
                  </span>
                </label>
              )}
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {/* Collapsible permissions info */}
            <div className="mt-2 text-xs">
              <button
                type="button"
                className="text-blue-700 underline hover:text-blue-900 focus:outline-none"
                onClick={() => setShowPerms((v) => !v)}
                tabIndex={0}
              >
                {showPerms ? 'Hide required service account permissions' : 'Click to view required service account permissions'}
              </button>
              {showPerms && (
                <div className="mt-2 text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">
                  <span className="font-semibold">The following permissions should be enabled for your service account:</span>
                  <ul className="list-disc ml-5 mt-1">
                    <li>roles/compute.networkAdmin</li>
                    <li>roles/compute.securityAdmin</li>
                    <li>roles/container.admin</li>
                    <li>roles/iam.serviceAccountAdmin</li>
                    <li>roles/iam.serviceAccountUser</li>
                    <li>roles/storage.objectAdmin</li>
                    <li>roles/compute.viewer</li>
                    <li>roles/resourcemanager.projectIamAdmin</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      case 'array':
        const arrayValue = value || [];
        return (
          <div key={fieldPath} className="space-y-3">
            <Label className="flex items-center text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.helpText && (
                <Tooltip content={field.helpText}>
                  <Info className="w-4 h-4 ml-2 text-[#9db309] cursor-help" />
                </Tooltip>
              )}
            </Label>
            <div className="space-y-2">
              {arrayValue.map((item: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const newArray = [...arrayValue];
                      newArray[index] = e.target.value;
                      updateValue(newArray);
                    }}
                    placeholder={`${field.label} ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newArray = arrayValue.filter((_: any, i: number) => i !== index);
                      updateValue(newArray);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateValue([...arrayValue, ''])}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add {field.label}</span>
              </Button>
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case 'dynamic-pool-group':
        const pools = formData[field.name] || [];
        return (
          <div key={fieldPath} className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {field.label}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPool = field.fields?.reduce((acc, f) => {
                    acc[f.name] = '';
                    return acc;
                  }, {} as any) || {};
                  updateFormData({ [field.name]: [...pools, newPool] });
                }}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add {field.poolType?.toUpperCase()} Pool</span>
              </Button>
            </div>

            <div className="space-y-4">
              {pools.map((pool: any, poolIndex: number) => (
                <Card key={poolIndex}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-sm font-normal">
                      {field.poolType?.toUpperCase()} Pool {poolIndex + 1}
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newPools = pools.filter((_: any, i: number) => i !== poolIndex);
                        updateFormData({ [field.name]: newPools });
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {field.fields?.map((poolField) => {
                        // Handle conditional options based on dependsOn
                        let fieldOptions = poolField.options;

                        if (poolField.dependsOn && fieldOptions) {
                          const dependentValue = pool[poolField.dependsOn] || '';

                          if (Array.isArray(fieldOptions)) {
                            // Find options for this dependent value
                            const matchingOption = fieldOptions.find(
                              (option) => option.when === dependentValue
                            );

                            // If there's a matching option, use its options
                            // Otherwise fall back to the empty value options or a safe placeholder
                            const emptyOption = fieldOptions.find((option) => option.when === "");

                            if (matchingOption) {
                              fieldOptions = matchingOption.options;
                            } else if (emptyOption) {
                              fieldOptions = emptyOption.options;
                            } else {
                              fieldOptions = [{ value: "_placeholder_", label: "No options available" }];
                            }
                          }
                        }

                        return (
                          <div key={poolField.name} className="space-y-2">
                            <Label className="text-sm font-medium">
                              {poolField.label}
                              {poolField.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {poolField.type === 'select' ? (
                              <Select
                                value={pool[poolField.name] || ''}
                                onValueChange={(value) => {
                                  const newPools = [...pools];
                                  newPools[poolIndex] = { ...pool, [poolField.name]: value };

                                  // If this field has dependent fields, reset them when this field changes
                                  if (field.fields) {
                                    const dependentFields = field.fields.filter(
                                      (f) => f.dependsOn === poolField.name
                                    );

                                    if (dependentFields.length > 0) {
                                      dependentFields.forEach(depField => {
                                        newPools[poolIndex][depField.name] = '';
                                      });
                                    }
                                  }

                                  updateFormData({ [field.name]: newPools });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${poolField.label}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldOptions?.filter(option => option.value !== '').map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={pool[poolField.name] || ''}
                                onChange={(e) => {
                                  const newPools = [...pools];
                                  newPools[poolIndex] = { ...pool, [poolField.name]: e.target.value };
                                  updateFormData({ [field.name]: newPools });
                                }}
                                placeholder={poolField.placeholder}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'group':
        return (
          <Card key={fieldPath} className="space-y-4">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {field.label}
              </CardTitle>
              {field.helpText && (
                <CardDescription>{field.helpText}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {field.fields?.map((subField) => renderField(subField, field.name))}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8 relative">
      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-xl shadow-2xl border-2 bg-white border-blue-300 shadow-blue-100 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 rounded-t-xl bg-blue-50 border-b border-blue-200">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-base font-semibold">Processing...</span>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-sm font-medium text-blue-800">
                Cluster creation is in progress...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {modal.type && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative z-10 w-full max-w-md rounded-xl shadow-2xl border-2 animate-in fade-in-0 zoom-in-95 duration-200 ${modal.type === 'success'
            ? 'bg-white border-green-300 shadow-green-100'
            : modal.type === 'error'
              ? 'bg-white border-red-300 shadow-red-100'
              : 'bg-white border-yellow-300 shadow-yellow-100'
            }`}>
            <div className={`flex items-center justify-between px-6 py-4 rounded-t-xl ${modal.type === 'success'
              ? 'bg-green-50 border-b border-green-200'
              : modal.type === 'error'
                ? 'bg-red-50 border-b border-red-200'
                : 'bg-yellow-50 border-b border-yellow-200'
              }`}>
              <div className="flex items-center space-x-3">
                {modal.type === 'success' && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                {modal.type === 'error' && <AlertTriangle className="w-6 h-6 text-red-600" />}
                {modal.type === 'info' && <Info className="w-6 h-6 text-yellow-600" />}
                <span className="text-base font-semibold">
                  {modal.type === 'success' ? 'Success!' : modal.type === 'error' ? 'Error!' : 'Validation'}
                </span>
              </div>
              {(modal.type === 'info' || modal.type === 'error') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setModal({ type: null, messages: [] })}
                  className="hover:bg-white/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="px-6 py-4 space-y-2">
              {modal.messages.map((m, i) => (
                <div key={i} className={`text-sm font-medium ${modal.type === 'success'
                  ? 'text-green-800'
                  : modal.type === 'error'
                    ? 'text-red-800'
                    : 'text-yellow-800'
                  }`}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {template.fields.map((field) => renderField(field))}
      </div>

      <Separator />

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className="flex items-center space-x-2 bg-[#9db309] hover:bg-[#8ca208] text-white">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{submitButtonText}</span>
        </Button>
      </div>
    </form>
  );
}
