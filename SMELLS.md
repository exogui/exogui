# Code Smells and Technical Debt

This file tracks known code smells, architectural issues, and technical debt in the codebase. These are not bugs, but areas that could be improved for better maintainability, performance, or user experience.

## Online Update System Issues

### Monolithic CSS File
**Priority:** Low
**Severity:** Low
**Effort:** High

**Issue:**
All CSS lives in `core.css` (2756 lines). Update system added 477 lines for UpdateDialog and DeveloperPage.

**Trade-offs:**
- ✅ Simple: One file, no CSS module complexity
- ✅ Consistent: All styles use same theme variables
- ❌ Hard to navigate: 2756 lines in one file
- ❌ No encapsulation: Global scope, potential conflicts

**Potential Solutions:**
1. **CSS Modules:** Scope styles to components
2. **Split files:** `core.css`, `update-dialog.css`, `developer-page.css`, etc.
3. **CSS-in-JS:** Styled-components or similar
4. **Keep as-is:** If it works, don't fix it

**Recommendation:** Keep as-is. Refactoring CSS doesn't provide enough value unless we're already experiencing naming conflicts.

---

## Contributing

When adding new code to this project:
- Check this file for related smells before implementing
- Consider if your changes make existing smells worse
- Update this file if you introduce a new smell or fix an existing one
- Don't feel obligated to fix every smell - some are intentional trade-offs

This file is for awareness, not for creating technical debt guilt. Ship working code first, optimize later.
