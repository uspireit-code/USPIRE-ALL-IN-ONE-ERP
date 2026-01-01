import type React from 'react';
import { tokens } from '../designTokens';

export function Input(props: {
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  autoCorrect?: React.InputHTMLAttributes<HTMLInputElement>['autoCorrect'];
  autoCapitalize?: React.InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  style?: React.CSSProperties;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: string;
}) {
  const base: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}, background-color ${tokens.transition.normal}`,
    opacity: props.disabled ? 0.6 : 1,
  };

  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      defaultValue={props.defaultValue}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder}
      name={props.name}
      autoComplete={props.autoComplete}
      autoCorrect={props.autoCorrect}
      autoCapitalize={props.autoCapitalize}
      inputMode={props.inputMode}
      step={props.step}
      style={{
        ...base,
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = tokens.focusRing.borderColor;
        e.currentTarget.style.boxShadow = tokens.focusRing.ring;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = tokens.colors.border.default;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}
