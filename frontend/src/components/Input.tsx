import React from 'react';
import { tokens } from '../designTokens';

export type InputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  name?: string;
  autoComplete?: string;
  autoCorrect?: React.InputHTMLAttributes<HTMLInputElement>['autoCorrect'];
  autoCapitalize?: React.InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  style?: React.CSSProperties;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: string;
  required?: boolean;
  touched?: boolean;
  error?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const invalid = Boolean(props.touched && props.error);

  const base: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${invalid ? '#ef4444' : tokens.colors.border.default}`,
    background: invalid ? '#fef2f2' : tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}, background-color ${tokens.transition.normal}`,
    opacity: props.disabled ? 0.6 : 1,
  };

  return (
    <div style={{ width: '100%' }}>
      <input
        ref={ref}
        type={props.type ?? 'text'}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        disabled={props.disabled}
        placeholder={props.placeholder}
        className={props.className}
        name={props.name}
        autoComplete={props.autoComplete}
        autoCorrect={props.autoCorrect}
        autoCapitalize={props.autoCapitalize}
        inputMode={props.inputMode}
        step={props.step}
        aria-required={props.required ? 'true' : undefined}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? `${props.name || 'input'}-error` : undefined}
        style={{
          ...base,
          ...props.style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = invalid ? '#ef4444' : tokens.focusRing.borderColor;
          e.currentTarget.style.boxShadow = invalid
            ? '0 0 0 3px rgba(239, 68, 68, 0.28)'
            : tokens.focusRing.ring;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid ? '#ef4444' : tokens.colors.border.default;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      <div
        id={invalid ? `${props.name || 'input'}-error` : undefined}
        style={{
          minHeight: 16,
          marginTop: 4,
          fontSize: 12,
          lineHeight: '16px',
          color: invalid ? '#dc2626' : 'transparent',
          fontWeight: 650,
        }}
      >
        {invalid ? props.error : '\u00A0'}
      </div>
    </div>
  );
});
