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
  rightAdornment?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const invalid = Boolean(props.touched && props.error);
  const hasRightAdornment = Boolean(props.rightAdornment);

  const resolvedRightAdornment = (() => {
    const node = props.rightAdornment;
    if (!node) return null;
    if (!React.isValidElement(node)) return node;

    // Normalize common case: a button used as a right-side toggle (e.g. password eye)
    if (typeof node.type === 'string' && node.type.toLowerCase() === 'button') {
      const existingProps: any = node.props ?? {};
      const existingClassName = typeof existingProps.className === 'string' ? existingProps.className : '';
      const mergedClassName = [
        'bg-transparent',
        'border-0',
        'shadow-none',
        'p-1',
        'rounded-md',
        'text-slate-500',
        'hover:text-slate-700',
        'focus:outline-none',
        existingClassName,
      ]
        .filter(Boolean)
        .join(' ');

      const mergedStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        ...(existingProps.style ?? {}),
      };

      const existingOnFocus = existingProps.onFocus as React.FocusEventHandler<HTMLButtonElement> | undefined;
      const existingOnBlur = existingProps.onBlur as React.FocusEventHandler<HTMLButtonElement> | undefined;

      return React.cloneElement(node as React.ReactElement<any>, {
        className: mergedClassName,
        style: mergedStyle,
        disabled: props.disabled || existingProps.disabled,
        tabIndex: typeof existingProps.tabIndex === 'number' ? existingProps.tabIndex : 0,
        onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
          existingOnFocus?.(e);
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 4, 69, 0.12)';
        },
        onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
          existingOnBlur?.(e);
          e.currentTarget.style.boxShadow = 'none';
        },
      });
    }

    return node;
  })();

  const resolvedPaddingRight = (() => {
    const fromStyle = (props.style as any)?.paddingRight;
    const min = hasRightAdornment ? 44 : 12;
    if (typeof fromStyle === 'number') return Math.max(fromStyle, min);
    if (typeof fromStyle === 'string') {
      const parsed = Number.parseFloat(fromStyle);
      if (Number.isFinite(parsed)) return Math.max(parsed, min);
    }
    return min;
  })();

  const base: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    paddingRight: resolvedPaddingRight,
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
      <div style={{ position: 'relative', width: '100%' }}>
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

        {hasRightAdornment ? (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {resolvedRightAdornment}
          </div>
        ) : null}
      </div>

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
