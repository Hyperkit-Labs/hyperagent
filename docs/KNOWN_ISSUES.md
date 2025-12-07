# Known Issues & Limitations

**Last Updated**: 2025-01-27  
**Version**: 1.0.0

## Current Known Issues

### 1. TestingAgent Hardhat Dependency

**Status**: ✅ Fixed (Phase 0.1)

**Previous Issue**: 
- Hardhat required local installation in project directory
- TestingAgent compilation failed with "non-local installation" error

**Solution Applied**:
- TestingAgent now requires `compiled_contract` from CompilationService
- Removed compilation logic from TestingAgent
- Hardhat is only used for test execution (with local npm install)
- Compilation is exclusively handled by CompilationService

**Impact**: 
- Workflows now require CompilationService to run before TestingAgent
- This is the correct architecture (separation of concerns)

### 2. Network Feature Detection is Scattered

**Status**: ⚠️ Will be fixed by Network Compatibility Framework (Phase 1-4)

**Current State**:
- PEF: Hard error if not Hyperion (`hyperion_pef.py:194`)
- EigenDA: Only checks `network.startswith("mantle")` (`deployment_service.py:353`)
- MetisVM: Only checks `network.startswith("hyperion")` (`generation_service.py:30`)

**Impact**:
- No graceful fallbacks when features are unavailable
- Hard errors instead of warnings
- Difficult to add new networks

**Planned Fix**: 
- Centralized network feature registry (Phase 1)
- Graceful fallback logic (Phase 2)
- User-facing warnings (Phase 3)

### 3. End-to-End Workflow Partial

**Status**: ⚠️ In Progress

**Current State**:
- Workflow creation: ✅ Working
- Workflow execution: ⚠️ Partial (blocked by TestingAgent issue - now fixed)
- Can test with `skip_testing: true` flag

**Next Steps**:
- Verify complete workflow after TestingAgent fix
- Test all network combinations
- Document workflow execution patterns

## Network-Specific Limitations

### Hyperion Networks

**Available Features**:
- ✅ PEF (Parallel Execution Framework)
- ✅ MetisVM Optimizations
- ✅ Batch Deployment (parallel)
- ✅ Floating-Point Operations
- ✅ AI Inference

**Limitations**:
- ❌ EigenDA not available (Mantle-specific)

### Mantle Networks

**Available Features**:
- ✅ EigenDA (mainnet only)
- ✅ Batch Deployment (sequential)
- ✅ Standard EVM features

**Limitations**:
- ❌ PEF not available (Hyperion-specific)
- ❌ MetisVM not available (Hyperion-specific)
- ❌ EigenDA disabled on testnet (cost optimization)

### Other Networks

**Available Features**:
- ✅ Basic deployment
- ✅ Standard EVM features

**Limitations**:
- ❌ No network-specific optimizations
- ❌ No advanced features (PEF, MetisVM, EigenDA)

## Workarounds

### Testing Without Hardhat

If Hardhat installation fails:
1. Use `skip_testing: true` flag in workflow creation
2. Or ensure Hardhat is available globally: `npm install -g hardhat`
3. Or use Foundry instead (set `ENABLE_FOUNDRY=true`)

### Using Unavailable Features

If you request a feature that's not available for your network:
- **Current behavior**: Hard error or silent skip
- **After Phase 2**: Graceful fallback with warning message
- **After Phase 3**: Automatic feature validation with user notification

## Future Improvements

### Planned (Network Compatibility Framework)

1. **Centralized Feature Detection** (Phase 1)
   - Single source of truth for network capabilities
   - Easy to add new networks

2. **Graceful Fallbacks** (Phase 2)
   - Automatic fallback to basic features
   - Clear warning messages

3. **User-Facing Configuration** (Phase 3)
   - API endpoints for network capabilities
   - CLI commands for network info
   - Workflow feature validation

4. **Extensibility** (Phase 4)
   - Custom network registration
   - Network configuration files
   - Dynamic feature detection

## Reporting Issues

If you encounter issues not listed here:

1. Check if it's a known limitation (this document)
2. Check if it will be fixed by Network Compatibility Framework
3. Report new issues with:
   - Network used
   - Feature requested
   - Error message
   - Steps to reproduce

### 4. CLI Command Stubs (Non-Blocking)

**Status**: ⚠️ Minor - Workarounds Available

**Stubbed Commands**:

1. **`hyperagent contract test`**
   - **Status**: Shows warning message, not implemented
   - **Location**: `hyperagent/cli/commands/contracts.py`
   - **Reason**: Pending test endpoint availability
   - **Impact**: Low - Testing happens automatically in workflows
   - **Workaround**: Use workflow testing or test endpoints directly

2. **`hyperagent deployment interact`**
   - **Status**: Placeholder with helpful message
   - **Location**: `hyperagent/cli/commands/deployments.py`
   - **Reason**: Pending implementation
   - **Impact**: Low - Users can interact via Web3.py directly
   - **Workaround**: Use Web3.py or contract interaction libraries directly

**Impact**: 
- These are convenience commands, not critical functionality
- Core testing and deployment work through workflows and API
- Users have alternative methods available

### 5. Event Handler Database Logging (Optional)

**Status**: ⚠️ Optional Feature - Console Logging Works

**Current State**:
- `AuditLoggerHandler.handle()` has TODO for database logging
- **Location**: `hyperagent/events/handlers.py:86-96`
- **Status**: Commented-out code, not implemented
- **Current Behavior**: Events are logged to console/files

**Impact**:
- Low - Events are still logged and tracked
- Database logging would be nice-to-have for analytics
- Console/file logging provides sufficient debugging capability

**Planned**: Will be implemented when database logging infrastructure is prioritized

## Related Documentation

- `docs/NETWORK_COMPATIBILITY.md` - Network feature compatibility matrix (Phase 5)
- `docs/CURRENT_STATUS_AND_NEXT_STEPS.md` - Current implementation status
- `docs/IMPLEMENTATION_STATUS.md` - Overall project status

