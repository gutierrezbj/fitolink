"""Estilo de marca AgroM para los gráficos del sandbox — editorial, cálido, sobrio.
Convierte los plots de matplotlib (feos por defecto) en algo presentable.
"""
import matplotlib as mpl

# Paleta AgroM
DEEP = "#1B4332"; TERRA = "#E07A3C"; INK = "#0F2A22"; PAPER = "#F4F0E8"
PARCH = "#E8DDC9"; RULE = "#C9A876"; MUTED = "#6B6B5C"
PURPLE = "#8E6BB0"; SLATE = "#3C7AB0"; SAND = "#C2B280"


def apply():
    mpl.rcParams.update({
        "figure.facecolor": PAPER,
        "axes.facecolor": PAPER,
        "savefig.facecolor": PAPER,
        "savefig.edgecolor": PAPER,
        "axes.edgecolor": MUTED,
        "axes.linewidth": 0.9,
        "axes.grid": True,
        "axes.axisbelow": True,
        "grid.color": RULE,
        "grid.alpha": 0.28,
        "grid.linewidth": 0.7,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "text.color": INK,
        "axes.labelcolor": INK,
        "axes.titlecolor": DEEP,
        "axes.titlesize": 12.5,
        "axes.titleweight": "bold",
        "axes.titlepad": 12,
        "axes.labelsize": 11,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelsize": 9.5,
        "ytick.labelsize": 9.5,
        "font.family": "sans-serif",
        "font.sans-serif": ["Helvetica Neue", "Helvetica", "Avenir Next", "Arial", "DejaVu Sans"],
        "axes.prop_cycle": mpl.cycler(color=[DEEP, TERRA, PURPLE, SLATE, RULE, SAND]),
        "lines.linewidth": 1.8,
        "lines.markersize": 4,
        "legend.frameon": False,
        "legend.fontsize": 9,
        "figure.dpi": 130,
    })
