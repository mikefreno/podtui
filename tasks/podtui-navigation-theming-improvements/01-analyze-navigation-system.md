# 01. Analyze Current Navigation and Layer System

meta:
  id: podtui-navigation-theming-improvements-01
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: []
  tags: [analysis, debugging, navigation]

objective:
- Analyze current navigation implementation and layer system
- Identify issues with the existing layerDepth signal
- Document current navigation behavior and identify gaps
- Understand how layers should work per user requirements

deliverables:
- Analysis document with current navigation state
- List of identified issues and gaps
- Recommendations for navigation improvements

steps:
- Read src/App.tsx to understand current layerDepth implementation
- Read src/components/Layout.tsx to understand layout structure
- Read src/hooks/useAppKeyboard.ts to understand keyboard handling
- Read src/components/TabNavigation.tsx and src/components/Navigation.tsx
- Review how layerDepth is used across components
- Identify issues with current navigation UX
- Document requirements: clear layer separation, active layer bg colors, left/right navigation, enter/escape controls
- Create analysis summary

tests:
- Unit: None (analysis task)
- Integration: None (analysis task)

acceptance_criteria:
- Analysis document is created and saved
- All current navigation patterns are documented
- All identified issues and gaps are listed
- Clear recommendations are provided for navigation improvements

validation:
- Review analysis document for completeness
- Verify all relevant files were analyzed
- Check that requirements are clearly documented

notes:
- Focus on understanding the gap between current implementation and user requirements
- Pay special attention to how layerDepth signal is managed
- Note any issues with keyboard event handling
- Consider how to make navigation more intuitive
