class CapitalAllocator {
  getRegimeRiskProfile(currentRegimeId = "mixed") {
    const profiles = {
      trend: {
        riskMultiplier: Number(process.env.ALLOCATION_TREND_MULTIPLIER || 1),
        maxExposureRatio: Number(process.env.ALLOCATION_TREND_MAX_EXPOSURE || 1),
        label: "Trend"
      },
      sideways: {
        riskMultiplier: Number(process.env.ALLOCATION_SIDEWAYS_MULTIPLIER || 0.5),
        maxExposureRatio: Number(process.env.ALLOCATION_SIDEWAYS_MAX_EXPOSURE || 0.5),
        label: "Sideways"
      },
      volatile: {
        riskMultiplier: Number(process.env.ALLOCATION_VOLATILE_MULTIPLIER || 0.75),
        maxExposureRatio: Number(process.env.ALLOCATION_VOLATILE_MAX_EXPOSURE || 0.75),
        label: "Volatile"
      },
      mixed: {
        riskMultiplier: Number(process.env.ALLOCATION_MIXED_MULTIPLIER || 0.75),
        maxExposureRatio: Number(process.env.ALLOCATION_MIXED_MAX_EXPOSURE || 0.6),
        label: "Mixed"
      }
    };

    return profiles[currentRegimeId] || profiles.mixed;
  }

  buildAllocationPlan({
    currentRegimeId = "mixed",
    runtimeRiskPerTrade = 0.01,
    availableCapital = 0,
    reservedCapital = 0
  } = {}) {
    const profile = this.getRegimeRiskProfile(currentRegimeId);
    const normalizedAvailableCapital = Math.max(0, Number(availableCapital || 0));
    const normalizedReservedCapital = Math.max(0, Number(reservedCapital || 0));
    const deployableCapital = Math.max(
      0,
      normalizedAvailableCapital * Number(profile.maxExposureRatio || 1)
    );

    return {
      regimeId: currentRegimeId,
      regimeLabel: profile.label,
      riskMultiplier: Number(profile.riskMultiplier || 1),
      maxExposureRatio: Number(profile.maxExposureRatio || 1),
      baseRiskPerTrade: Number(runtimeRiskPerTrade || 0),
      effectiveRiskPerTrade: Math.max(
        0.001,
        Number(runtimeRiskPerTrade || 0) * Number(profile.riskMultiplier || 1)
      ),
      availableCapital: normalizedAvailableCapital,
      reservedCapital: normalizedReservedCapital,
      deployableCapital
    };
  }

  buildStrategySetAllocation({
    currentRegimeId = "mixed",
    strategyIds = [],
    availableCapital = 0,
    reservedCapital = 0
  } = {}) {
    const allocationPlan = this.buildAllocationPlan({
      currentRegimeId,
      availableCapital,
      reservedCapital,
      runtimeRiskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01)
    });
    const normalizedStrategyIds = Array.isArray(strategyIds) ? [...new Set(strategyIds.filter(Boolean))] : [];
    const perStrategyCapital =
      normalizedStrategyIds.length > 0 ? allocationPlan.deployableCapital / normalizedStrategyIds.length : 0;

    return {
      ...allocationPlan,
      strategyCount: normalizedStrategyIds.length,
      strategyTargets: normalizedStrategyIds.map((strategyId) => ({
        strategyId,
        capitalTarget: perStrategyCapital
      }))
    };
  }
}

module.exports = CapitalAllocator;
