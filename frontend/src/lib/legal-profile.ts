function publicValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

export const legalProfile = {
  operatorKind: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_KIND),
  operatorName: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME),
  operatorRut: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_RUT),
  operatorAddress: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS),
  representative: publicValue(process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE),
  contactEmail: publicValue(process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL),
  privacyEmail: publicValue(process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL),
  processors: publicValue(process.env.NEXT_PUBLIC_PRIVACY_PROCESSORS),
};

export const operatorIdentityComplete = Boolean(
  ["natural", "juridica"].includes(legalProfile.operatorKind ?? "") &&
    legalProfile.operatorName &&
    legalProfile.operatorRut &&
    legalProfile.operatorAddress &&
    legalProfile.contactEmail &&
    (legalProfile.operatorKind !== "juridica" || legalProfile.representative),
);
