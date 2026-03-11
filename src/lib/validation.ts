// Comprehensive form validation utilities

export interface ValidationRule {
  test: (value: unknown) => boolean;
  message: string;
}

export interface FieldValidation {
  required?: boolean | string;
  minLength?: { value: number; message?: string };
  maxLength?: { value: number; message?: string };
  pattern?: { value: RegExp; message?: string };
  custom?: ValidationRule[];
  validate?: (value: unknown) => string | boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class FormValidator {
  private rules: Map<string, FieldValidation> = new Map();
  private errors: Map<string, string> = new Map();
  
  constructor(rules: Record<string, FieldValidation>) {
    Object.entries(rules).forEach(([field, validation]) => {
      this.rules.set(field, validation);
    });
  }
  
  // Validate a single field
  validateField(field: string, value: unknown): string | null {
    const validation = this.rules.get(field);
    if (!validation) return null;
    
    // Required validation
    if (validation.required) {
      const isEmpty = value === undefined || value === null || value === '' || 
                     (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        const message = typeof validation.required === 'string' 
          ? validation.required 
          : `This field is required`;
        this.errors.set(field, message);
        return message;
      }
    }
    
    // Skip other validations if value is empty and not required
    if (!value && !validation.required) {
      this.errors.delete(field);
      return null;
    }
    
    // Min length validation
    if (validation.minLength) {
      const length = typeof value === 'string' ? value.length : 
                    Array.isArray(value) ? value.length : 0;
      if (length < validation.minLength.value) {
        const message = validation.minLength.message || 
          `Must be at least ${validation.minLength.value} characters`;
        this.errors.set(field, message);
        return message;
      }
    }
    
    // Max length validation
    if (validation.maxLength) {
      const length = typeof value === 'string' ? value.length : 
                    Array.isArray(value) ? value.length : 0;
      if (length > validation.maxLength.value) {
        const message = validation.maxLength.message || 
          `Must be no more than ${validation.maxLength.value} characters`;
        this.errors.set(field, message);
        return message;
      }
    }
    
    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      if (!validation.pattern.value.test(value)) {
        const message = validation.pattern.message || 'Invalid format';
        this.errors.set(field, message);
        return message;
      }
    }
    
    // Custom validation function
    if (validation.validate) {
      const result = validation.validate(value);
      if (typeof result === 'string') {
        this.errors.set(field, result);
        return result;
      } else if (result === false) {
        const message = 'Validation failed';
        this.errors.set(field, message);
        return message;
      }
    }
    
    // Custom validation rules
    if (validation.custom) {
      for (const rule of validation.custom) {
        if (!rule.test(value)) {
          this.errors.set(field, rule.message);
          return rule.message;
        }
      }
    }
    
    // Field is valid
    this.errors.delete(field);
    return null;
  }
  
  // Validate all fields
  validateAll(data: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    
    this.rules.forEach((validation, field) => {
      const error = this.validateField(field, data[field]);
      if (error) {
        errors[field] = error;
      }
    });
    
    return errors;
  }
  
  // Check if form is valid
  isValid(data: Record<string, unknown>): boolean {
    const errors = this.validateAll(data);
    return Object.keys(errors).length === 0;
  }
  
  // Get current errors
  getErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    this.errors.forEach((message, field) => {
      errors[field] = message;
    });
    return errors;
  }
  
  // Clear errors for a field
  clearFieldError(field: string): void {
    this.errors.delete(field);
  }
  
  // Clear all errors
  clearErrors(): void {
    this.errors.clear();
  }
}

