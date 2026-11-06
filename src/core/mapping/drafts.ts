import { type Json, parseJson, stringify } from '../json/value';
import { type MappingRule, type MappingIssue, validateMappingRules } from './engine';
export interface MappingDraft extends Omit<MappingRule, 'defaultValue' | 'constantValue'> {
  useDefault: boolean;
  defaultText: string;
  constantText: string;
}
export function toDraft(rule: MappingRule): MappingDraft {
  const { defaultValue, constantValue, ...base } = rule;
  return {
    ...base,
    useDefault: Object.hasOwn(rule, 'defaultValue'),
    defaultText: defaultValue === undefined ? 'null' : stringify(defaultValue, 0),
    constantText: constantValue === undefined ? 'null' : stringify(constantValue, 0),
  };
}
export function compileDrafts(drafts: MappingDraft[]): {
  rules: MappingRule[];
  errors: MappingIssue[];
} {
  const errors: MappingIssue[] = [],
    rules: MappingRule[] = [];
  for (const draft of drafts) {
    try {
      const { useDefault, defaultText, constantText, ...rule } = draft;
      const values: { defaultValue?: Json; constantValue?: Json } = {};
      if (useDefault) values.defaultValue = parseJson(defaultText);
      if (rule.transform === 'constant') values.constantValue = parseJson(constantText);
      rules.push({ ...rule, ...values });
    } catch (e) {
      errors.push({ ruleId: draft.id, message: `기본값/상수 JSON 오류: ${(e as Error).message}` });
    }
  }
  if (!errors.length) errors.push(...validateMappingRules(rules).errors);
  return { rules, errors };
}
